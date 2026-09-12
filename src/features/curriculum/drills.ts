import type { Drill, Lesson } from '@/data/curriculum/en/types.ts';
import { generateLetterDrill, generateWordDrill, type KeyUsageMap } from '@/lib/engine';

/**
 * Menyusun teks target sebuah lesson dari definisi drill-nya (dok. 04 §6).
 *
 * Drill `static` dipakai apa adanya; drill `weighted-random` dibangkitkan
 * generator berbobot (dok. 04 §8) dari statistik nyata pengguna — sehingga
 * review session menjadi personal, dan jatuh ke bobot seragam kalau `keystats`
 * masih kosong (dok. 04 §7).
 *
 * Pool wordlist dimuat **dinamis**: ia milik chunk `wordlists` dan tidak boleh
 * ikut ke bundel awal (dok. 06 §6).
 */

export type DrillStats = KeyUsageMap;

const WORD_BASED = new Set(['words', 'phrases', 'sentences']);

let poolsPromise: Promise<Record<string, string[]>> | null = null;

function loadPools(): Promise<Record<string, string[]>> {
  poolsPromise ??= import('@/data/wordlists/en/index.ts').then((mod) => mod.pools);
  return poolsPromise;
}

function needsPools(lesson: Lesson): boolean {
  return lesson.drills.some(
    (d) => d.generator === 'weighted-random' && d.pool !== undefined && WORD_BASED.has(d.type),
  );
}

function oneDrill(
  drill: Drill,
  lesson: Lesson,
  stats: DrillStats,
  pools: Record<string, string[]>,
  random: () => number,
): string {
  if (drill.generator === 'static') return drill.content ?? '';

  const length = drill.length ?? 120;
  const shape = {
    newKeys: lesson.newKeys,
    reviewKeys: lesson.reviewKeys,
    length,
    stats,
    random,
  };

  if (drill.pool !== undefined && WORD_BASED.has(drill.type)) {
    const pool = pools[drill.pool];
    // Pool yang tidak dikenal tidak boleh mematikan lesson: validator kurikulum
    // sudah menjaga ini di CI, jadi di runtime cukup jatuh ke drill huruf.
    if (pool && pool.length > 0) return generateWordDrill({ ...shape, pool });
  }

  return generateLetterDrill(shape);
}

/** Satu drill yang sudah menjadi teks, beserta perannya dalam penilaian. */
export interface ResolvedDrill {
  text: string;
  /** Bagian tes kelulusan kursus, bukan penilaian lesson (dok. 04 §4a, ADR-030). */
  graduation: boolean;
}

/**
 * Semua drill sebuah lesson, berurutan, siap diketik.
 *
 * Yang kosong dibuang: sebuah drill kosong akan menyelesaikan sesinya sendiri
 * tanpa satu pun keystroke, dan itu terlihat seperti drill yang dilewati.
 *
 * Penanda `graduation` ikut dikembalikan **bersama teksnya**, bukan sebagai
 * daftar indeks terpisah: pembuangan drill kosong di atas menggeser indeks, dan
 * dua sumber indeks yang bisa bergeser sendiri-sendiri adalah persis bentuk bug
 * yang sudah dua kali memakan proyek ini (catatan penutup Fase 3).
 */
export async function resolveDrills(
  lesson: Lesson,
  stats: DrillStats = {},
  random: () => number = Math.random,
): Promise<ResolvedDrill[]> {
  const pools = needsPools(lesson) ? await loadPools() : {};
  return lesson.drills
    .map((drill) => ({
      text: oneDrill(drill, lesson, stats, pools, random).trim(),
      graduation: drill.graduation === true,
    }))
    .filter((d) => d.text.length > 0);
}

/** Teksnya saja — untuk pemanggil yang tidak peduli pembagian penilaian. */
export async function resolveDrillTexts(
  lesson: Lesson,
  stats: DrillStats = {},
  random: () => number = Math.random,
): Promise<string[]> {
  return (await resolveDrills(lesson, stats, random)).map((d) => d.text);
}

/** Panjang drill mikro — sekitar 30 detik untuk pemula (dok. 04 §9 percobaan 3). */
const MICRO_LENGTH = 90;

/**
 * Drill mikro untuk tombol yang gagal (dok. 04 §9, percobaan ke-3).
 *
 * Tombol yang bermasalah masuk sebagai `newKeys` supaya bobot dasarnya 2.0, dan
 * sisa tombol lesson tetap ikut sebagai konteks: melatih `a` dan `;` sendirian
 * tanpa huruf lain menghasilkan hafalan posisi, bukan ritme.
 */
export function microDrillFor(
  lesson: Lesson,
  failedKeys: string[],
  stats: DrillStats = {},
  random: () => number = Math.random,
): string {
  const allowed = new Set([...lesson.newKeys, ...lesson.reviewKeys]);
  const focus = failedKeys.filter((k) => allowed.has(k));
  if (focus.length === 0) return '';

  const rest = [...allowed].filter((k) => !focus.includes(k));
  return generateLetterDrill({
    newKeys: focus,
    reviewKeys: rest,
    length: MICRO_LENGTH,
    stats,
    random,
  });
}
