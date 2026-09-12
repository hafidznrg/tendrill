import type { Lesson, Unit } from '@/data/curriculum/en/types.ts';
import { units } from '@/data/curriculum/en/units.ts';

/**
 * Pemuat lesson untuk layar sesi (dok. 06 §6).
 *
 * Sengaja TIDAK mengimpor `data/curriculum/en/index.ts`: berkas itu menarik
 * ketujuh unit sekaligus, dan layar sesi hanya butuh satu. `units.ts` ikut
 * karena ia hanya 7 objek kecil tanpa isi drill, dan kriteria unit dibutuhkan
 * untuk menampilkan target kelulusan.
 *
 * Pemetaannya ditulis sebagai `switch` literal, bukan
 * `import(\`./unit-${n}.ts\`)`: hanya specifier literal yang bisa dijadikan
 * chunk terpisah oleh bundler secara andal.
 */

export type UnitLessons = Lesson[];

export function loadUnitLessons(unitId: string): Promise<UnitLessons> {
  switch (unitId) {
    case 'u0':
      return import('@/data/curriculum/en/lessons/unit-0.ts').then((m) => m.unit0Lessons);
    case 'u1':
      return import('@/data/curriculum/en/lessons/unit-1.ts').then((m) => m.unit1Lessons);
    case 'u2':
      return import('@/data/curriculum/en/lessons/unit-2.ts').then((m) => m.unit2Lessons);
    case 'u3':
      return import('@/data/curriculum/en/lessons/unit-3.ts').then((m) => m.unit3Lessons);
    case 'u4':
      return import('@/data/curriculum/en/lessons/unit-4.ts').then((m) => m.unit4Lessons);
    case 'u5':
      return import('@/data/curriculum/en/lessons/unit-5.ts').then((m) => m.unit5Lessons);
    case 'u6':
      return import('@/data/curriculum/en/lessons/unit-6.ts').then((m) => m.unit6Lessons);
    default:
      return Promise.resolve([]);
  }
}

/** `"u3-l2"` → `"u3"`. Tidak memakai regex — formatnya cukup kaku. */
export function unitIdOf(lessonId: string): string {
  const dash = lessonId.indexOf('-');
  return dash < 0 ? lessonId : lessonId.slice(0, dash);
}

export interface LoadedLesson {
  lesson: Lesson;
  unit: Unit;
  /** Lesson berikutnya di seluruh kurikulum, atau null kalau ini yang terakhir. */
  nextLessonId: string | null;
}

/**
 * Muat satu lesson beserta unitnya.
 *
 * Lesson berikutnya dihitung dari unit ini dan urutan unit — tanpa memuat
 * seluruh kurikulum. Kalau lesson ini yang terakhir di unitnya, yang berikutnya
 * adalah lesson pertama unit sesudahnya, yang mungkin belum dimuat; cukup id-nya
 * yang dibutuhkan, jadi tidak ada impor tambahan.
 */
export async function loadLesson(lessonId: string): Promise<LoadedLesson | null> {
  const unitId = unitIdOf(lessonId);
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return null;

  const inUnit = await loadUnitLessons(unitId);
  const index = inUnit.findIndex((l) => l.id === lessonId);
  if (index < 0) return null;

  let nextId: string | null = inUnit[index + 1]?.id ?? null;
  if (nextId === null) {
    const nextUnit = units.find((u) => u.order === unit.order + 1);
    if (nextUnit) {
      const nextLessons = await loadUnitLessons(nextUnit.id);
      nextId = nextLessons[0]?.id ?? null;
    }
  }

  return { lesson: inUnit[index]!, unit, nextLessonId: nextId };
}
