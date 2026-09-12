import { describe, expect, it } from 'vitest';
import { curriculum } from '@/data/curriculum/en/index.ts';
import { defaultProgress } from '@/lib/storage/schema.ts';
import type { SessionResult } from '@/lib/engine';
import { applyPlacement, placementTier, weakSkippedCluster } from '../placement.ts';
import { isPassed, nextLessonId, unlockedLessonIds } from '../progress.ts';

/**
 * Placement test (dok. 04 §3, R-14) — DoD Fase 3 poin 1: "penempatan yang masuk
 * akal untuk 3 profil uji".
 *
 * Profilnya dipilih supaya bukan hanya ambangnya yang diuji, tetapi juga
 * **akibatnya di aplikasi**: setelah penempatan, apakah lesson yang benar yang
 * terbuka, dan apakah unit yang dilewati masih bisa dibuka kembali.
 */

const lessons = curriculum.lessons;

describe('ambang penempatan (dok. 04 §3)', () => {
  it.each([
    [0, 100, [], 'u1'],
    [19, 99, [], 'u1'],
    [45, 84, [], 'u1'], // cepat tapi tidak akurat → tetap dari nol
    [20, 85, ['u1'], 'u2'],
    [34, 91, ['u1'], 'u2'],
    [35, 92, ['u1', 'u2', 'u3'], 'u4'],
    [54, 94, ['u1', 'u2', 'u3'], 'u4'],
    [55, 95, ['u1', 'u2', 'u3', 'u4', 'u5'], 'u6'],
    [90, 99, ['u1', 'u2', 'u3', 'u4', 'u5'], 'u6'],
  ])('%i WPM / %i%% → lewati %j, mulai di %s', (wpm, acc, skipped, start) => {
    const tier = placementTier(wpm, acc);
    expect(tier.skippedUnitIds).toEqual(skipped);
    expect(tier.startUnitId).toBe(start);
  });

  it('akurasi rendah tidak pernah bisa ditebus kecepatan', () => {
    // Ini prinsip #4 dok. 04 §1 di titik paling awal: 90 WPM dengan 80% akurasi
    // adalah pengguna yang justru paling butuh Unit 1.
    expect(placementTier(90, 80).skippedUnitIds).toEqual([]);
  });

  it('hanya tingkat teratas yang dipenuhi yang berlaku', () => {
    // 60 WPM tapi 93% → tidak memenuhi tingkat teratas (butuh 95%), jadi jatuh
    // ke tingkat berikutnya — bukan gagal seluruhnya.
    expect(placementTier(60, 93).startUnitId).toBe('u4');
  });

  it('menyarankan latihan adaptif hanya di tingkat teratas', () => {
    expect(placementTier(60, 96).suggestAdaptive).toBe(true);
    expect(placementTier(40, 93).suggestAdaptive).toBe(false);
  });
});

describe('tiga profil uji, sampai ke akibatnya di aplikasi', () => {
  it('profil A — pemula sejati (12 WPM / 82%): mulai u1-l1, nol unit dilewati', () => {
    const { progress, tier } = applyPlacement(defaultProgress(), lessons, 12, 82, 1000);
    expect(tier.skippedUnitIds).toEqual([]);
    expect(progress.placement).toMatchObject({ netWpm: 12, unlockedThrough: null });
    expect(nextLessonId(progress, lessons)).toBe('u1-l1');
    expect(unlockedLessonIds(progress, lessons).has('u2-l1')).toBe(false);
  });

  it('profil B — menengah tersendat (28 WPM / 88%): Unit 1 dilewati, mulai u2-l1', () => {
    const { progress } = applyPlacement(defaultProgress(), lessons, 28, 88, 1000);
    const u1 = lessons.filter((l) => l.unitId === 'u1');
    for (const l of u1) {
      expect(progress.lessons[l.id]!.status).toBe('passed-by-placement');
    }
    // Termasuk review-nya — kalau review dibiarkan, "dilewati" jadi bohong dan
    // Unit 2 tidak pernah terbuka.
    expect(progress.lessons['u1-review']!.status).toBe('passed-by-placement');
    expect(nextLessonId(progress, lessons)).toBe('u2-l1');

    // Dilewati, tapi tetap bisa dibuka kembali (dok. 04 §3).
    const unlocked = unlockedLessonIds(progress, lessons);
    for (const l of u1) expect(unlocked.has(l.id)).toBe(true);
  });

  it('profil C — sudah cepat (62 WPM / 96%): Unit 1–5 dilewati, mulai u6-l1', () => {
    const { progress, tier } = applyPlacement(defaultProgress(), lessons, 62, 96, 1000);
    expect(tier.startUnitId).toBe('u6');
    expect(progress.placement!.unlockedThrough).toBe('u5');
    expect(nextLessonId(progress, lessons)).toBe('u6-l1');
    for (const l of lessons) {
      if (l.unitId === 'u6') expect(isPassed(progress.lessons[l.id]?.status)).toBe(false);
    }
  });
});

describe('placement yang diulang', () => {
  it('tidak menurunkan lesson yang sudah lulus sendiri', () => {
    const first = applyPlacement(defaultProgress(), lessons, 12, 82, 1).progress;
    first.lessons['u1-l1'] = {
      status: 'passed',
      attempts: 3,
      bestWpm: 25,
      bestAccuracy: 97,
      firstPassedAt: 5,
      lastAttemptAt: 5,
    };

    const second = applyPlacement(first, lessons, 30, 90, 900).progress;
    expect(second.lessons['u1-l1']!.status).toBe('passed');
    expect(second.lessons['u1-l1']!.bestWpm).toBe(25);
    expect(second.lessons['u1-l2']!.status).toBe('passed-by-placement');
  });

  it('menimpa lesson yang baru "attempted" — placement memang lebih kuat dari coba-coba', () => {
    const p = defaultProgress();
    p.lessons['u1-l3'] = {
      status: 'attempted',
      attempts: 1,
      bestWpm: 8,
      bestAccuracy: 70,
      firstPassedAt: null,
      lastAttemptAt: 2,
    };
    const after = applyPlacement(p, lessons, 30, 90, 900).progress;
    expect(after.lessons['u1-l3']!.status).toBe('passed-by-placement');
    expect(after.lessons['u1-l3']!.attempts).toBe(1);
  });
});

function resultWith(errorsByKey: Record<string, number>): SessionResult {
  return {
    target: '',
    durationMs: 60_000,
    grossWPM: 40,
    netWPM: 38,
    accuracy: 93,
    totalKeystrokes: 300,
    correctKeystrokes: 280,
    consistency: 0.8,
    errorsByKey,
    latencyByKey: {},
    confusions: [],
    logOverflowed: false,
    completedAt: 1,
  };
}

describe('saran gugus lemah (dok. 04 §3)', () => {
  it('menyebut unit yang dilewati tapi tombolnya masih sering meleset', () => {
    // v, c, x adalah newKeys Unit 3.
    const hint = weakSkippedCluster(resultWith({ v: 4, c: 3, x: 2 }), lessons, [
      'u1',
      'u2',
      'u3',
    ]);
    expect(hint).not.toBeNull();
    expect(hint!.unitId).toBe('u3');
    expect(hint!.keys).toEqual(['v', 'c', 'x']);
  });

  it('diam kalau errornya terlalu sedikit untuk disebut pola', () => {
    expect(weakSkippedCluster(resultWith({ v: 1 }), lessons, ['u3'])).toBeNull();
  });

  it('tidak menyebut unit yang TIDAK dilewati — itu akan dilatih sendiri', () => {
    expect(weakSkippedCluster(resultWith({ v: 9, c: 9 }), lessons, ['u1'])).toBeNull();
  });

  it('memilih satu gugus terburuk, bukan semuanya', () => {
    const hint = weakSkippedCluster(resultWith({ f: 9, j: 8, v: 3 }), lessons, ['u1', 'u3']);
    expect(hint!.unitId).toBe('u1');
    expect(hint!.keys.length).toBeLessThanOrEqual(3);
  });
});
