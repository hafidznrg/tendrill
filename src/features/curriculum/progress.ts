import type { Lesson, PassCriteria } from '@/data/curriculum/en/types.ts';
import { reconcileProgress } from '@/lib/storage';
import type { LessonProgress, LessonStatus, ProgressData } from '@/lib/storage/schema.ts';

/**
 * Logika progres kurikulum (dok. 04 §9, dok. 05 §3).
 *
 * **Pure.** Tanpa React, tanpa storage — menerima `ProgressData` dan daftar
 * lesson, mengembalikan nilai baru. Hook `useProgress` yang menempelkannya ke
 * storage. Pemisahan ini yang membuat seluruh DoD Fase 3 (unlock benar saat
 * progres kosong/rusak/menunjuk lesson yang sudah dihapus) bisa diuji tanpa
 * browser (dok. 09 §4).
 *
 * Aturan unlock TIDAK DISIMPAN, selalu dihitung ulang (dok. 05 §3): kalau ia
 * disimpan, tiap perubahan kurikulum akan meninggalkan data yang tidak konsisten
 * dengan kurikulumnya sendiri.
 */

/** Semua varian "sudah lulus". Satu tempat saja — ini dipakai di lima tempat. */
export const PASSED_STATUSES: ReadonlySet<LessonStatus> = new Set<LessonStatus>([
  'passed',
  'passed-with-assist',
  'passed-by-placement',
]);

export function isPassed(status: LessonStatus | undefined): boolean {
  return status !== undefined && PASSED_STATUSES.has(status);
}

export function emptyLessonProgress(): LessonProgress {
  return {
    status: 'locked',
    attempts: 0,
    bestWpm: 0,
    bestAccuracy: 0,
    firstPassedAt: null,
    lastAttemptAt: 0,
  };
}

/**
 * Entri progres satu lesson, dibersihkan.
 *
 * `localStorage` bisa diedit tangan, jadi entri yang bentuknya salah dianggap
 * tidak ada (dok. 05 §1 poin 5) — bukan dipakai apa adanya lalu meledak saat
 * `attempts` ternyata sebuah string.
 */
export function entryFor(progress: ProgressData, lessonId: string): LessonProgress | undefined {
  const raw = progress.lessons[lessonId] as unknown;
  if (typeof raw !== 'object' || raw === null) return undefined;
  const entry = raw as Partial<LessonProgress>;
  if (typeof entry.status !== 'string') return undefined;

  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    status: entry.status as LessonStatus,
    attempts: num(entry.attempts),
    bestWpm: num(entry.bestWpm),
    bestAccuracy: num(entry.bestAccuracy),
    firstPassedAt: typeof entry.firstPassedAt === 'number' ? entry.firstPassedAt : null,
    lastAttemptAt: num(entry.lastAttemptAt),
  };
}

export interface LessonView {
  lesson: Lesson;
  status: LessonStatus;
  unlocked: boolean;
  attempts: number;
  bestWpm: number;
  bestAccuracy: number;
}

/**
 * Status + keterbukaan setiap lesson, dalam urutan kurikulum.
 *
 * Aturannya (dok. 05 §3):
 * - Placement selalu terbuka dan tidak pernah menjadi syarat apa pun — ia opsional.
 * - Lesson nyata pertama selalu terbuka; tanpa ini pengguna yang melewatkan
 *   placement tidak punya satu pun pintu masuk.
 * - Lesson berikutnya terbuka kalau lesson nyata SEBELUMNYA sudah lulus, dalam
 *   varian apa pun — termasuk `passed-with-assist` dan `passed-by-placement`.
 * - Lesson yang entrinya sendiri sudah lulus selalu terbuka, supaya unit yang
 *   dilewati placement tetap bisa dibuka kembali kapan pun (dok. 04 §3).
 *
 * Id progres yang lesson-nya sudah tidak ada diabaikan lewat `reconcileProgress`
 * (R-22) — tidak dihapus, hanya tidak ikut menghitung.
 */
export function lessonViews(progress: ProgressData, lessons: Lesson[]): LessonView[] {
  const { active } = reconcileProgress(progress, lessons.map((l) => l.id));
  const known: ProgressData = { ...progress, lessons: active };

  const views: LessonView[] = [];
  let previousRealPassed = true; // lesson nyata pertama selalu terbuka
  for (const lesson of lessons) {
    const entry = entryFor(known, lesson.id);
    const status = entry?.status ?? 'locked';
    const selfPassed = isPassed(status);
    const unlocked = lesson.kind === 'placement' || previousRealPassed || selfPassed;

    views.push({
      lesson,
      status,
      unlocked,
      attempts: entry?.attempts ?? 0,
      bestWpm: entry?.bestWpm ?? 0,
      bestAccuracy: entry?.bestAccuracy ?? 0,
    });

    if (lesson.kind !== 'placement') previousRealPassed = selfPassed;
  }
  return views;
}

export function unlockedLessonIds(progress: ProgressData, lessons: Lesson[]): Set<string> {
  return new Set(
    lessonViews(progress, lessons)
      .filter((v) => v.unlocked)
      .map((v) => v.lesson.id),
  );
}

/**
 * Lesson berikutnya yang layak dikerjakan: yang terbuka dan belum lulus.
 *
 * Kalau semuanya sudah lulus, kembalikan null — pemanggil yang memutuskan apa
 * yang ditampilkan, dan "kurikulum selesai" bukan keadaan error.
 */
export function nextLessonId(progress: ProgressData, lessons: Lesson[]): string | null {
  for (const view of lessonViews(progress, lessons)) {
    if (view.lesson.kind === 'placement') continue;
    if (view.unlocked && !isPassed(view.status)) return view.lesson.id;
  }
  return null;
}

// --- assist ladder (dok. 04 §9, dok. 02 §5) ---------------------------------

/** Penurunan target WPM pada percobaan 4–5. Akurasi TIDAK pernah diturunkan. */
export const ASSIST_WPM_FACTOR = 0.8;

export interface AssistState {
  /** Percobaan ke berapa (1-based) — penggerak seluruh tangga. */
  attempt: number;
  /** ≥ 3: diagnosis ditampilkan lebih menonjol + tawarkan drill mikro. */
  prominentDiagnosis: boolean;
  offerMicroDrill: boolean;
  /** ≥ 4: target WPM diturunkan 20%. */
  wpmRelaxed: boolean;
  /** ≥ 6: tawarkan "lanjut saja" → `passed-with-assist`. */
  offerSkip: boolean;
}

/**
 * Tangga bantuan berdasarkan jumlah percobaan (dok. 04 §9).
 *
 * Tangganya **kumulatif**: bantuan yang sudah muncul di percobaan 3 tidak hilang
 * di percobaan 6. Menariknya kembali tepat saat pengguna paling mentok adalah
 * kebalikan dari tujuan tangga ini.
 */
export function assistFor(attempt: number): AssistState {
  const n = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  return {
    attempt: n,
    prominentDiagnosis: n >= 3,
    offerMicroDrill: n >= 3,
    wpmRelaxed: n >= 4,
    offerSkip: n >= 6,
  };
}

/**
 * Kriteria yang benar-benar dipakai pada percobaan ke-`attempt`.
 *
 * **Akurasi tidak pernah ikut turun** (dok. 04 §9, prinsip #4 dok. 04 §1):
 * kecepatan boleh menunggu, ketepatan tidak. Kalau akurasi juga diturunkan,
 * pengguna lulus dengan memori otot yang salah — dan itu utang yang ditagih
 * dua unit kemudian.
 */
export function effectiveCriteria(base: PassCriteria, attempt: number): PassCriteria {
  if (!assistFor(attempt).wpmRelaxed) return base;
  return {
    minWpm: Math.round(base.minWpm * ASSIST_WPM_FACTOR),
    minAccuracy: base.minAccuracy,
  };
}

export function meetsCriteria(
  netWpm: number,
  accuracy: number,
  criteria: PassCriteria,
): boolean {
  return netWpm >= criteria.minWpm && accuracy >= criteria.minAccuracy;
}

// --- pencatatan hasil -------------------------------------------------------

export interface AttemptOutcome {
  netWpm: number;
  accuracy: number;
  passed: boolean;
  at: number;
}

/**
 * Catat satu percobaan. Mengembalikan `ProgressData` BARU (tidak memutasi).
 *
 * `firstPassedAt` hanya ditulis sekali, dan status yang sudah lulus tidak pernah
 * diturunkan kembali menjadi `attempted`: mengulang lesson yang sudah lulus lalu
 * gagal bukan alasan mencabut kelulusannya — itu akan mengunci lesson-lesson
 * sesudahnya dan terbaca sebagai progres yang hilang.
 */
export function recordAttempt(
  progress: ProgressData,
  lessonId: string,
  outcome: AttemptOutcome,
): ProgressData {
  const before = entryFor(progress, lessonId) ?? emptyLessonProgress();
  const alreadyPassed = isPassed(before.status);

  const status: LessonStatus = outcome.passed
    ? alreadyPassed
      ? before.status
      : 'passed'
    : alreadyPassed
      ? before.status
      : 'attempted';

  return {
    ...progress,
    lessons: {
      ...progress.lessons,
      [lessonId]: {
        status,
        attempts: before.attempts + 1,
        bestWpm: Math.max(before.bestWpm, outcome.netWpm),
        bestAccuracy: Math.max(before.bestAccuracy, outcome.accuracy),
        firstPassedAt:
          before.firstPassedAt ?? (outcome.passed || alreadyPassed ? outcome.at : null),
        lastAttemptAt: outcome.at,
      },
    },
  };
}

/**
 * "Lanjut saja" pada percobaan ke-6 (dok. 04 §9).
 *
 * Tidak disembunyikan: statusnya berbeda dari `passed`, `/learn` menandainya, dan
 * review session akan menagihnya kembali. Inilah bedanya jalan keluar dari
 * menyerah.
 */
export function markPassedWithAssist(
  progress: ProgressData,
  lessonId: string,
  at: number,
): ProgressData {
  const before = entryFor(progress, lessonId) ?? emptyLessonProgress();
  if (isPassed(before.status)) return progress;
  return {
    ...progress,
    lessons: {
      ...progress.lessons,
      [lessonId]: {
        ...before,
        status: 'passed-with-assist',
        firstPassedAt: before.firstPassedAt ?? at,
        lastAttemptAt: at,
      },
    },
  };
}
