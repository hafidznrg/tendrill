/**
 * Jumlah kolom teks, diturunkan dari pengukuran (ADR-028).
 *
 * Berdiri sendiri, bukan di dalam `TypingStage`, karena ia pure dan diuji
 * langsung — dan karena mengekspor fungsi dari berkas komponen mematikan fast
 * refresh.
 *
 * Sebelum ADR-028 angkanya konstanta 52 yang tidak pernah diperiksa terhadap
 * kotaknya. Lebar default aplikasi (`max-w-3xl` 768 − `px-6` 2×24 = 720 px)
 * dibagi `charWidth` 14,4 px hanya memuat **50**, sehingga browser memotong dua
 * karakter sisanya ke baris berikutnya — dan caret, yang dihitung aritmetika
 * dari `lineStarts`, meleset satu baris tanpa satu pun tanda.
 */

/** Lebih dari ini, mata kesulitan kembali ke awal baris (dok. 07 §2). */
export const MAX_COLS = 60;
/** Jendela sangat sempit tetap harus menghasilkan baris yang bisa diketik. */
export const MIN_COLS = 20;
/** Dipakai hanya sampai pengukuran pertama selesai; sesi belum aktif di situ. */
export const FALLBACK_COLS = 50;

export function colsFor(width: number, charWidth: number): number {
  if (!(width > 0) || !(charWidth > 0)) return FALLBACK_COLS;
  const fits = Math.floor(width / charWidth);
  return Math.max(MIN_COLS, Math.min(MAX_COLS, fits));
}
