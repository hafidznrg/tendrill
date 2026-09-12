import { describe, expect, it } from 'vitest';
import { curriculum } from '@/data/curriculum/en/index.ts';
import type { Lesson } from '@/data/curriculum/en/types.ts';
import { defaultProgress } from '@/lib/storage/schema.ts';
import type { LessonStatus, ProgressData } from '@/lib/storage/schema.ts';
import {
  assistFor,
  effectiveCriteria,
  lessonViews,
  markPassedWithAssist,
  meetsCriteria,
  nextLessonId,
  recordAttempt,
  unlockedLessonIds,
} from '../progress.ts';

/**
 * Logika unlock & assist ladder (dok. 09 §4).
 *
 * DoD Fase 3 menuntut unlock benar **termasuk saat progres kosong, rusak, atau
 * menunjuk lesson yang sudah dihapus** (R-22) — ketiganya ada di bawah, dan
 * ketiganya adalah keadaan yang pasti terjadi di data pengguna nyata, bukan
 * kasus tepi teoretis.
 */

const lessons = curriculum.lessons;
const real = lessons.filter((l) => l.kind !== 'placement');

function withStatuses(entries: Record<string, LessonStatus>): ProgressData {
  const progress = defaultProgress();
  for (const [id, status] of Object.entries(entries)) {
    progress.lessons[id] = {
      status,
      attempts: 1,
      bestWpm: 20,
      bestAccuracy: 96,
      firstPassedAt: 1,
      lastAttemptAt: 1,
    };
  }
  return progress;
}

describe('unlock', () => {
  it('progres kosong → hanya placement + lesson pertama yang terbuka', () => {
    const unlocked = unlockedLessonIds(defaultProgress(), lessons);
    expect([...unlocked].sort()).toEqual(['u0-placement', 'u1-l1'].sort());
  });

  it('lesson N terbuka hanya setelah N-1 lulus', () => {
    const unlocked = unlockedLessonIds(withStatuses({ 'u1-l1': 'passed' }), lessons);
    expect(unlocked.has('u1-l2')).toBe(true);
    expect(unlocked.has('u1-l3')).toBe(false);
  });

  it.each<LessonStatus>(['passed', 'passed-with-assist', 'passed-by-placement'])(
    'status "%s" ikut membuka lesson berikutnya',
    (status) => {
      const unlocked = unlockedLessonIds(withStatuses({ 'u1-l1': status }), lessons);
      expect(unlocked.has('u1-l2')).toBe(true);
    },
  );

  it('status "attempted" TIDAK membuka lesson berikutnya', () => {
    const unlocked = unlockedLessonIds(withStatuses({ 'u1-l1': 'attempted' }), lessons);
    expect(unlocked.has('u1-l2')).toBe(false);
  });

  it('review adalah gerbang unit: unit berikutnya tertutup sampai review lulus', () => {
    const upToLastLesson: Record<string, LessonStatus> = {};
    for (const l of real) {
      if (l.unitId !== 'u1') break;
      if (l.kind === 'review') break;
      upToLastLesson[l.id] = 'passed';
    }
    const unlocked = unlockedLessonIds(withStatuses(upToLastLesson), lessons);
    expect(unlocked.has('u1-review')).toBe(true);
    expect(unlocked.has('u2-l1')).toBe(false);
  });

  it('id yang sudah tidak ada di kurikulum diabaikan, bukan dihapus (R-22)', () => {
    const progress = withStatuses({ 'u1-l1': 'passed', 'u9-l9-hantu': 'passed' });
    const views = lessonViews(progress, lessons);

    // Diabaikan saat menghitung unlock…
    expect(views.some((v) => v.lesson.id === 'u9-l9-hantu')).toBe(false);
    expect(unlockedLessonIds(progress, lessons).has('u1-l2')).toBe(true);
    // …tetapi TETAP ADA di data. Menghapus progres seseorang karena kita
    // mengganti nama id adalah kerugian yang tidak bisa dibatalkan (dok. 05 §3).
    expect(progress.lessons['u9-l9-hantu']).toBeDefined();
  });

  it('entri yang bentuknya rusak dianggap tidak ada, tanpa melempar', () => {
    const progress = defaultProgress();
    // Persis bentuk yang muncul kalau localStorage diedit tangan.
    progress.lessons['u1-l1'] = { status: 'passed', attempts: 'banyak' } as never;
    progress.lessons['u1-l2'] = null as never;
    progress.lessons['u1-l3'] = 'passed' as never;

    expect(() => lessonViews(progress, lessons)).not.toThrow();
    const views = lessonViews(progress, lessons);
    const l1 = views.find((v) => v.lesson.id === 'u1-l1')!;
    // Status tetap dibaca, angka yang tidak masuk akal dijadikan 0.
    expect(l1.status).toBe('passed');
    expect(l1.attempts).toBe(0);
    expect(views.find((v) => v.lesson.id === 'u1-l3')!.status).toBe('locked');
  });

  it('kurikulum yang menyusut tidak mengunci pengguna keluar', () => {
    // Semua lesson Unit 1 lulus, lalu Unit 1 dihapus dari kurikulum.
    const passedAll: Record<string, LessonStatus> = {};
    for (const l of lessons) if (l.unitId === 'u1') passedAll[l.id] = 'passed';
    const shrunk: Lesson[] = lessons.filter((l) => l.unitId !== 'u1');

    const unlocked = unlockedLessonIds(withStatuses(passedAll), shrunk);
    // Lesson nyata pertama dari kurikulum yang tersisa tetap terbuka.
    expect(unlocked.has('u2-l1')).toBe(true);
  });

  it('placement selalu terbuka dan tidak pernah menjadi syarat', () => {
    const views = lessonViews(defaultProgress(), lessons);
    expect(views[0]!.lesson.kind).toBe('placement');
    expect(views[0]!.unlocked).toBe(true);
    expect(views.find((v) => v.lesson.id === 'u1-l1')!.unlocked).toBe(true);
  });
});

describe('nextLessonId', () => {
  it('progres kosong → lesson nyata pertama, bukan placement', () => {
    expect(nextLessonId(defaultProgress(), lessons)).toBe('u1-l1');
  });

  it('melewati yang sudah lulus, termasuk yang dilewati placement', () => {
    const skipped: Record<string, LessonStatus> = {};
    for (const l of lessons) if (l.unitId === 'u1') skipped[l.id] = 'passed-by-placement';
    expect(nextLessonId(withStatuses(skipped), lessons)).toBe('u2-l1');
  });

  it('seluruh kurikulum lulus → null, bukan error', () => {
    const all: Record<string, LessonStatus> = {};
    for (const l of real) all[l.id] = 'passed';
    expect(nextLessonId(withStatuses(all), lessons)).toBeNull();
  });
});

describe('assist ladder (dok. 04 §9)', () => {
  const base = { minWpm: 20, minAccuracy: 95 };

  it('percobaan 1–2: tanpa bantuan apa pun', () => {
    for (const n of [1, 2]) {
      expect(assistFor(n)).toMatchObject({
        prominentDiagnosis: false,
        wpmRelaxed: false,
        offerSkip: false,
      });
      expect(effectiveCriteria(base, n)).toEqual(base);
    }
  });

  it('percobaan 3: diagnosis menonjol + drill mikro, kriteria BELUM berubah', () => {
    expect(assistFor(3)).toMatchObject({
      prominentDiagnosis: true,
      offerMicroDrill: true,
      wpmRelaxed: false,
      offerSkip: false,
    });
    expect(effectiveCriteria(base, 3)).toEqual(base);
  });

  it('percobaan 4–5: target WPM turun 20%, akurasi TIDAK ikut turun', () => {
    for (const n of [4, 5]) {
      expect(assistFor(n).wpmRelaxed).toBe(true);
      expect(assistFor(n).offerSkip).toBe(false);
      const relaxed = effectiveCriteria(base, n);
      expect(relaxed.minWpm).toBe(16);
      expect(relaxed.minAccuracy).toBe(base.minAccuracy);
    }
  });

  it('percobaan ≥ 6: menawarkan "lanjut saja", bantuan sebelumnya tetap ada', () => {
    const assist = assistFor(6);
    expect(assist.offerSkip).toBe(true);
    expect(assist.prominentDiagnosis).toBe(true);
    expect(assist.wpmRelaxed).toBe(true);
  });

  it('akurasi tidak pernah diturunkan, bahkan di percobaan ke-20', () => {
    for (const l of curriculum.lessons) {
      for (let n = 1; n <= 20; n++) {
        expect(effectiveCriteria(l.passCriteria, n).minAccuracy).toBe(
          l.passCriteria.minAccuracy,
        );
      }
    }
  });

  it('angka percobaan yang tidak masuk akal tidak merusak tangga', () => {
    for (const n of [0, -5, Number.NaN]) {
      expect(assistFor(n).attempt).toBe(1);
      expect(effectiveCriteria(base, n)).toEqual(base);
    }
  });
});

describe('meetsCriteria', () => {
  it('butuh KEDUANYA — kecepatan saja tidak cukup, dan sebaliknya', () => {
    const c = { minWpm: 20, minAccuracy: 95 };
    expect(meetsCriteria(20, 95, c)).toBe(true);
    expect(meetsCriteria(25, 94.9, c)).toBe(false);
    expect(meetsCriteria(19.9, 99, c)).toBe(false);
  });
});

describe('recordAttempt', () => {
  it('mencatat percobaan pertama yang gagal sebagai "attempted"', () => {
    const next = recordAttempt(defaultProgress(), 'u1-l1', {
      netWpm: 12,
      accuracy: 88,
      passed: false,
      at: 1000,
    });
    expect(next.lessons['u1-l1']).toMatchObject({
      status: 'attempted',
      attempts: 1,
      bestWpm: 12,
      bestAccuracy: 88,
      firstPassedAt: null,
      lastAttemptAt: 1000,
    });
  });

  it('menyimpan angka TERBAIK, bukan yang terakhir', () => {
    let p = recordAttempt(defaultProgress(), 'u1-l1', {
      netWpm: 22,
      accuracy: 97,
      passed: true,
      at: 1,
    });
    p = recordAttempt(p, 'u1-l1', { netWpm: 15, accuracy: 90, passed: false, at: 2 });
    expect(p.lessons['u1-l1']).toMatchObject({
      status: 'passed',
      attempts: 2,
      bestWpm: 22,
      bestAccuracy: 97,
      firstPassedAt: 1,
    });
  });

  it('gagal setelah pernah lulus tidak mencabut kelulusan', () => {
    let p = recordAttempt(defaultProgress(), 'u1-l1', {
      netWpm: 30,
      accuracy: 98,
      passed: true,
      at: 1,
    });
    p = recordAttempt(p, 'u1-l1', { netWpm: 5, accuracy: 50, passed: false, at: 2 });
    expect(p.lessons['u1-l1']!.status).toBe('passed');
    expect(unlockedLessonIds(p, lessons).has('u1-l2')).toBe(true);
  });

  it('tidak memutasi progres yang lama', () => {
    const before = defaultProgress();
    recordAttempt(before, 'u1-l1', { netWpm: 9, accuracy: 80, passed: false, at: 1 });
    expect(before.lessons['u1-l1']).toBeUndefined();
  });
});

describe('markPassedWithAssist', () => {
  it('menandai lulus-dengan-bantuan dan membuka lesson berikutnya', () => {
    const p = markPassedWithAssist(defaultProgress(), 'u1-l1', 500);
    expect(p.lessons['u1-l1']).toMatchObject({
      status: 'passed-with-assist',
      firstPassedAt: 500,
    });
    expect(unlockedLessonIds(p, lessons).has('u1-l2')).toBe(true);
  });

  it('tidak menurunkan kelulusan yang sudah penuh', () => {
    const passed = withStatuses({ 'u1-l1': 'passed' });
    expect(markPassedWithAssist(passed, 'u1-l1', 900).lessons['u1-l1']!.status).toBe('passed');
  });
});
