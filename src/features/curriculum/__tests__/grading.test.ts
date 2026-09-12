import { describe, expect, it } from 'vitest';
import type { SessionResult } from '@/lib/engine';
import { GRADUATION_CRITERIA } from '@/data/curriculum/en/units.ts';
import { gradeAttempt } from '../grading.ts';
import { effectiveCriteria } from '../progress.ts';

/**
 * Pembagian penilaian `u6-review` (dok. 04 §4a, ADR-030).
 *
 * Yang diuji bukan rumusnya — itu milik `combine.ts` — melainkan **pembagiannya**:
 * drill mana masuk penilaian mana, dan apa yang terjadi kalau keduanya berbeda
 * putusan. Justru kasus "berbeda putusan" itu yang tidak pernah terjadi di 35
 * lesson lain, jadi ia tidak pernah teruji secara kebetulan.
 */

/** Satu hasil drill sintetis: `chars` karakter, `wrong` di antaranya salah. */
function drill(chars: number, wrong: number, seconds: number): SessionResult {
  const correct = chars - wrong;
  const minutes = seconds / 60;
  return {
    target: 'x'.repeat(chars),
    durationMs: seconds * 1000,
    grossWPM: chars / 5 / minutes,
    netWPM: correct / 5 / minutes,
    accuracy: (correct / chars) * 100,
    totalKeystrokes: chars,
    correctKeystrokes: correct,
    consistency: 1,
    errorsByKey: {},
    latencyByKey: {},
    confusions: [],
    logOverflowed: false,
    completedAt: 1_700_000_000_000,
  };
}

const UNIT = { minWpm: 25, minAccuracy: 93 };

describe('gradeAttempt (ADR-030)', () => {
  it('tanpa drill graduation, penilaian lesson = gabungan seluruh drill', () => {
    const results = [drill(200, 4, 30), drill(200, 4, 30)];
    const graded = gradeAttempt(results, [false, false], UNIT)!;

    expect(graded.graduation).toBeNull();
    expect(graded.lesson!.result.netWPM).toBeCloseTo(graded.combined.netWPM, 10);
    expect(graded.lesson!.result.accuracy).toBeCloseTo(graded.combined.accuracy, 10);
    expect(graded.lesson!.passed).toBe(true);
  });

  it('drill graduation TIDAK ikut menilai lesson, dan sebaliknya', () => {
    // Drill angka/simbol lambat (≈20 WPM), prosa cepat (≈48 WPM). Kalau salah
    // satu bocor ke penilaian yang lain, kedua angka di bawah ikut bergeser.
    const symbols = drill(100, 3, 30);
    const prose = [drill(240, 5, 30), drill(240, 5, 30)];
    const graded = gradeAttempt([symbols, ...prose], [false, true, true], UNIT)!;

    expect(graded.lesson!.result.totalKeystrokes).toBe(100);
    expect(graded.graduation!.result.totalKeystrokes).toBe(480);
    expect(graded.combined.totalKeystrokes).toBe(580);
    expect(graded.graduation!.criteria).toEqual(GRADUATION_CRITERIA);
  });

  it('gagal 40 WPM tidak menjatuhkan kelulusan lesson', () => {
    // Inti keputusan ADR-030: dua putusan, dan yang kedua tidak menggerbangi apa
    // pun. 30 WPM prosa = lulus unit (25), belum lulus kursus (40).
    const graded = gradeAttempt(
      [drill(100, 2, 26), drill(150, 3, 60), drill(150, 3, 60)],
      [false, true, true],
      UNIT,
    )!;
    expect(graded.lesson!.passed).toBe(true);
    expect(graded.graduation!.passed).toBe(false);
  });

  it('lulus 40 WPM sementara unitnya gagal juga mungkin — akurasi yang jatuh', () => {
    const graded = gradeAttempt(
      [drill(100, 20, 20), drill(250, 5, 30), drill(250, 5, 30)],
      [false, true, true],
      UNIT,
    )!;
    expect(graded.lesson!.passed).toBe(false); // 80% akurasi
    expect(graded.graduation!.passed).toBe(true);
  });

  it('ambang kelulusan kursus tidak ikut diturunkan assist ladder', () => {
    // Percobaan ke-4 menurunkan WPM lesson 20% (dok. 04 §9). 40 WPM tidak.
    const relaxed = effectiveCriteria(UNIT, 4);
    expect(relaxed.minWpm).toBe(20);

    const graded = gradeAttempt(
      [drill(100, 2, 30), drill(160, 3, 60), drill(160, 3, 60)],
      [false, true, true],
      relaxed,
    )!;
    expect(graded.lesson!.criteria.minWpm).toBe(20);
    expect(graded.graduation!.criteria.minWpm).toBe(40);
    expect(graded.graduation!.passed).toBe(false); // 32 WPM
  });

  it('flag yang kurang panjang dibaca sebagai drill biasa, bukan crash', () => {
    const graded = gradeAttempt([drill(100, 1, 30), drill(100, 1, 30)], [false], UNIT)!;
    expect(graded.lesson!.result.totalKeystrokes).toBe(200);
    expect(graded.graduation).toBeNull();
  });

  it('tanpa satu pun hasil, tidak ada yang dinilai', () => {
    expect(gradeAttempt([], [], UNIT)).toBeNull();
  });
});
