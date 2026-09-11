import type { KeystrokeLog } from './types.ts';

/**
 * Log keystroke kolumnar (dok. 03 §1.1).
 *
 * Kapasitas = panjang target × 2 + 64. Kelebihan 2× memberi ruang untuk koreksi;
 * +64 menjaga target yang sangat pendek tetap punya ruang wajar.
 */
export function createLog(targetLength: number): KeystrokeLog {
  const capacity = targetLength * 2 + 64;
  return {
    expectedCode: new Uint16Array(capacity),
    actualCode: new Uint16Array(capacity),
    atMs: new Float64Array(capacity),
    indexAt: new Int32Array(capacity),
    correct: new Uint8Array(capacity),
    count: 0,
    capacity,
    overflowed: false,
  };
}

/**
 * Catat satu keystroke. Nol alokasi.
 *
 * Saat kapasitas habis, log berhenti mencatat detail dan menyalakan `overflowed`
 * alih-alih tumbuh. Akumulator tetap dinaikkan oleh pemanggil, jadi WPM & akurasi
 * tetap benar — yang hilang hanya detail confusions/latensi untuk sisa sesi.
 * Inilah yang melindungi dari pengguna yang menahan satu tombol selama semenit.
 */
export function pushLog(
  log: KeystrokeLog,
  expectedCode: number,
  actualCode: number,
  atMs: number,
  indexAt: number,
  correct: boolean,
): void {
  if (log.count >= log.capacity) {
    log.overflowed = true;
    return;
  }
  const i = log.count;
  log.expectedCode[i] = expectedCode;
  log.actualCode[i] = actualCode;
  log.atMs[i] = atMs;
  log.indexAt[i] = indexAt;
  log.correct[i] = correct ? 1 : 0;
  log.count = i + 1;
}

/** Kosongkan log tanpa mengalokasikan buffer baru (dipakai saat restart). */
export function resetLog(log: KeystrokeLog): void {
  log.count = 0;
  log.overflowed = false;
}
