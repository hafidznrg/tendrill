import type { Lesson } from '@/data/curriculum/en/types.ts';
import type { SessionResult } from '@/lib/engine';
import type { ProgressData } from '@/lib/storage/schema.ts';
import { emptyLessonProgress } from './progress.ts';

/**
 * Placement test (dok. 04 §3, dok. 02 §2) — R-14.
 *
 * Pure. Ambangnya mengikat dok. 04 §3 dan diperiksa berurutan dari yang
 * tertinggi, jadi pengguna selalu mendapat penempatan tertinggi yang ia penuhi.
 *
 * Yang TIDAK dilakukan di sini: memaksa. Hasilnya **saran**, bukan vonis —
 * unit yang dilewati tetap bisa dibuka (aturan unlock di progress.ts membuka
 * lesson yang berstatus `passed-by-placement`), dan placement sendiri selalu
 * bisa dilewati.
 */

export interface PlacementTier {
  /** Unit yang ditandai `passed-by-placement`. Kosong = mulai dari Unit 1. */
  skippedUnitIds: string[];
  /** Unit tempat pengguna mulai. */
  startUnitId: string;
  /** Satu kalimat untuk layar hasil placement. */
  summary: string;
  /** dok. 04 §3 baris terakhir: sarankan latihan adaptif. */
  suggestAdaptive: boolean;
}

/** Ambang dok. 04 §3, tertinggi lebih dulu. */
const TIERS: Array<{ minWpm: number; minAccuracy: number; tier: PlacementTier }> = [
  {
    minWpm: 55,
    minAccuracy: 95,
    tier: {
      skippedUnitIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
      startUnitId: 'u6',
      summary: 'Dasarnya sudah terbentuk. Unit 1–5 dilewati, kamu mulai di angka dan simbol.',
      suggestAdaptive: true,
    },
  },
  {
    minWpm: 35,
    minAccuracy: 92,
    tier: {
      skippedUnitIds: ['u1', 'u2', 'u3'],
      startUnitId: 'u4',
      summary: 'Seluruh huruf sudah kamu kuasai. Unit 1–3 dilewati, kamu mulai di kata dan ritme.',
      suggestAdaptive: false,
    },
  },
  {
    minWpm: 20,
    minAccuracy: 85,
    tier: {
      skippedUnitIds: ['u1'],
      startUnitId: 'u2',
      summary: 'Baris awal sudah aman. Unit 1 dilewati, kamu mulai di baris atas.',
      suggestAdaptive: false,
    },
  },
];

const FROM_SCRATCH: PlacementTier = {
  skippedUnitIds: [],
  startUnitId: 'u1',
  summary: 'Kita mulai dari baris awal. Ini titik mulai yang paling cepat membentuk kebiasaan.',
  suggestAdaptive: false,
};

export function placementTier(netWpm: number, accuracy: number): PlacementTier {
  for (const { minWpm, minAccuracy, tier } of TIERS) {
    if (netWpm >= minWpm && accuracy >= minAccuracy) return tier;
  }
  return FROM_SCRATCH;
}

/**
 * Terapkan hasil placement ke progres.
 *
 * Seluruh lesson di unit yang dilewati ditandai `passed-by-placement`, termasuk
 * review session-nya: kalau review-nya dibiarkan belum lulus, unit berikutnya
 * tidak pernah terbuka dan "dilewati" menjadi bohong.
 *
 * Lesson yang sudah punya status lulus sebelumnya tidak ditimpa — placement yang
 * diulang tidak boleh menurunkan `passed` menjadi `passed-by-placement`.
 */
export function applyPlacement(
  progress: ProgressData,
  lessons: Lesson[],
  netWpm: number,
  accuracy: number,
  at: number,
): { progress: ProgressData; tier: PlacementTier } {
  const tier = placementTier(netWpm, accuracy);
  const skipped = new Set(tier.skippedUnitIds);

  const next: ProgressData['lessons'] = { ...progress.lessons };
  for (const lesson of lessons) {
    if (!skipped.has(lesson.unitId)) continue;
    const before = next[lesson.id];
    if (before && before.status !== 'locked' && before.status !== 'attempted') continue;
    next[lesson.id] = {
      ...emptyLessonProgress(),
      ...before,
      status: 'passed-by-placement',
      firstPassedAt: before?.firstPassedAt ?? at,
    };
  }

  return {
    progress: {
      ...progress,
      lessons: next,
      placement: {
        takenAt: at,
        netWpm,
        accuracy,
        unlockedThrough: tier.skippedUnitIds.at(-1) ?? null,
      },
    },
    tier,
  };
}

export interface WeakClusterHint {
  unitId: string;
  keys: string[];
}

/** Minimal kemunculan sebelum sebuah gugus layak disebut lemah, bukan kebetulan. */
const MIN_CLUSTER_ERRORS = 3;

/**
 * Saran "unit ini dilewati, tapi tombolnya masih sering meleset" (dok. 04 §3).
 *
 * Ini yang membuat placement tetap jujur: melewati Unit 3 tidak berarti `v c x`
 * sudah aman, dan diam soal itu berarti membiarkan kelemahan yang sudah terlihat
 * di sesi pertama. Dipilih gugus dengan error terbanyak, bukan semuanya —
 * pengguna hanya akan menindaklanjuti satu.
 */
export function weakSkippedCluster(
  result: SessionResult,
  lessons: Lesson[],
  skippedUnitIds: string[],
): WeakClusterHint | null {
  let worst: (WeakClusterHint & { errors: number }) | null = null;

  for (const unitId of skippedUnitIds) {
    const keys = lessons
      .filter((l) => l.unitId === unitId)
      .flatMap((l) => l.newKeys)
      .filter((k) => k.length === 1);

    let errors = 0;
    const offenders: Array<[string, number]> = [];
    for (const key of keys) {
      const count = result.errorsByKey[key] ?? 0;
      if (count > 0) offenders.push([key, count]);
      errors += count;
    }
    if (errors < MIN_CLUSTER_ERRORS) continue;
    if (!worst || errors > worst.errors) {
      worst = {
        unitId,
        errors,
        keys: offenders
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([key]) => key),
      };
    }
  }

  if (!worst) return null;
  return { unitId: worst.unitId, keys: worst.keys };
}
