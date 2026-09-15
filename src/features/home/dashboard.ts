import { isPassed } from '@/features/curriculum/progress.ts';
import { currentStreak, practiceDays } from '@/features/stats/stats.ts';
import type { Lesson, PassCriteria, Unit } from '@/data/curriculum/en/types.ts';
import type { DailyStat, ProgressData } from '@/lib/storage/schema.ts';

/**
 * Perhitungan dashboard beranda (ADR-039).
 *
 * PURE: tanpa React, tanpa storage. Tidak ada rumus kedua — hari berlatih dan
 * beruntun memakai `practiceDays`/`currentStreak` yang sama dengan `/stats`.
 */

// --- kartu lesson berikutnya ---------------------------------------------------

export interface UnitSegment {
  unitId: string;
  order: number;
  passed: number;
  total: number;
}

export interface NextLessonCard {
  /** null kalau seluruh kurikulum sudah lulus */
  lesson: Lesson | null;
  unit: Unit | null;
  /** posisi 1-based di dalam unitnya */
  position: number;
  unitTotal: number;
  criteria: PassCriteria | null;
  /** percobaan terbaik lesson ini, kalau pernah dicoba */
  best: { wpm: number; accuracy: number } | null;
  segments: UnitSegment[];
  passedCount: number;
  totalCount: number;
}

export function nextLessonCard(
  progress: ProgressData,
  lessons: Lesson[],
  units: Unit[],
  nextId: string | null,
): NextLessonCard {
  const real = lessons.filter((l) => l.kind !== 'placement');
  const passedIn = (l: Lesson) => isPassed(progress.lessons[l.id]?.status);

  const segments = units
    .filter((u) => u.order >= 1)
    .map((u) => {
      const inUnit = real.filter((l) => l.unitId === u.id);
      return {
        unitId: u.id,
        order: u.order,
        passed: inUnit.filter(passedIn).length,
        total: inUnit.length,
      };
    });

  const lesson = real.find((l) => l.id === nextId) ?? null;
  const unit = lesson ? (units.find((u) => u.id === lesson.unitId) ?? null) : null;
  const inUnit = lesson ? real.filter((l) => l.unitId === lesson.unitId) : [];
  const entry = lesson ? progress.lessons[lesson.id] : undefined;

  return {
    lesson,
    unit,
    position: lesson ? inUnit.indexOf(lesson) + 1 : 0,
    unitTotal: inUnit.length,
    criteria: lesson?.passCriteria ?? null,
    best:
      entry && entry.attempts > 0 ? { wpm: entry.bestWpm, accuracy: entry.bestAccuracy } : null,
    segments,
    passedCount: real.filter(passedIn).length,
    totalCount: real.length,
  };
}

// --- WPM & hari berlatih 7 hari ---------------------------------------------------

export const WEEK_DAYS = 7;

export interface WeekSummary {
  /** per hari, terlama → terbaru; null = tidak berlatih */
  wpm: (number | null)[];
  /** rata-rata avgWpm hari berlatih; null kalau tidak ada */
  meanWpm: number | null;
  practiced: number;
  streak: number;
}

export function weekSummary(daily: Record<string, DailyStat>, now: number): WeekSummary {
  const days = practiceDays(daily, now, WEEK_DAYS);
  const wpm = days.map((d) =>
    d.stat && Number.isFinite(d.stat.avgWpm) ? d.stat.avgWpm : null,
  );
  const values = wpm.filter((v): v is number => v !== null);
  return {
    wpm,
    meanWpm: values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length,
    practiced: days.filter((d) => d.stat !== null).length,
    streak: currentStreak(daily, now),
  };
}

/**
 * Titik garis mini WPM di kotak `width × height` (ADR-039). Hari tanpa latihan
 * tidak diberi titik; satu nilai saja digambar di tengah tinggi.
 */
export function sparklinePoints(
  wpm: (number | null)[],
  width: number,
  height: number,
  pad = 4,
): { x: number; y: number }[] {
  const values = wpm.filter((v): v is number => v !== null);
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const stepX = wpm.length > 1 ? (width - pad * 2) / (wpm.length - 1) : 0;
  const out: { x: number; y: number }[] = [];
  wpm.forEach((v, i) => {
    if (v === null) return;
    const t = max === min ? 0.5 : (v - min) / (max - min);
    out.push({ x: pad + i * stepX, y: height - pad - t * (height - pad * 2) });
  });
  return out;
}
