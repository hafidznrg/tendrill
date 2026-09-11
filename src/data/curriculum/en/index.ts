import type { Curriculum, Lesson, Unit } from './types.ts';
import { units } from './units.ts';
import { unit0Lessons } from './lessons/unit-0.ts';
import { unit1Lessons } from './lessons/unit-1.ts';
import { unit2Lessons } from './lessons/unit-2.ts';
import { unit3Lessons } from './lessons/unit-3.ts';
import { unit4Lessons } from './lessons/unit-4.ts';
import { unit5Lessons } from './lessons/unit-5.ts';
import { unit6Lessons } from './lessons/unit-6.ts';

/**
 * Kurikulum bahasa Inggris — Unit 0 + 30 lesson + 6 review session (dok. 04 §5).
 *
 * Catatan code-splitting (dok. 06 §6): file ini mengimpor SELURUH unit, jadi
 * hanya boleh dipakai di jalur yang memang butuh peta lengkap (halaman /learn,
 * validator, test). Layar sesi harus mengimpor `lessons/unit-N.ts` langsung
 * lewat dynamic import supaya data unit lain tidak ikut ke bundel awal.
 */
export const lessons: Lesson[] = [
  ...unit0Lessons,
  ...unit1Lessons,
  ...unit2Lessons,
  ...unit3Lessons,
  ...unit4Lessons,
  ...unit5Lessons,
  ...unit6Lessons,
];

export const curriculum: Curriculum = {
  locale: 'en',
  version: 1,
  units,
  lessons,
};

/** Urutan linear lesson di seluruh kurikulum — dasar aturan unlock (dok. 05 §3). */
export const lessonOrder: string[] = lessons.map((l) => l.id);

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}

export function getUnit(id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

export function lessonsOfUnit(unitId: string): Lesson[] {
  return lessons.filter((l) => l.unitId === unitId);
}

/** Semua tombol yang sudah diperkenalkan sampai (termasuk) lesson `id`. */
export function keysIntroducedThrough(id: string): string[] {
  const stop = lessonOrder.indexOf(id);
  if (stop < 0) return [];
  const seen = new Set<string>();
  for (let i = 0; i <= stop; i++) {
    const lesson = lessons[i];
    if (!lesson || lesson.kind === 'placement') continue;
    for (const key of lesson.newKeys) seen.add(key);
  }
  return [...seen];
}

export type { Curriculum, Drill, Lesson, Unit, PassCriteria } from './types.ts';
