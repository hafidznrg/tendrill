import type { Accumulators } from './types.ts';

/**
 * Akumulator inkremental (dok. 03 §1.2) — jalur cepat untuk metrik live.
 *
 * Welford dipakai supaya stdev jeda antar-keystroke (bahan "konsistensi") bisa
 * dihitung tanpa menyimpan array interval dan tanpa pemindaian ulang.
 */
export function createAccumulators(): Accumulators {
  return {
    total: 0,
    correct: 0,
    countInterval: 0,
    meanInterval: 0,
    m2Interval: 0,
    lastKeystrokeAt: 0,
  };
}

export function resetAccumulators(acc: Accumulators): void {
  acc.total = 0;
  acc.correct = 0;
  acc.countInterval = 0;
  acc.meanInterval = 0;
  acc.m2Interval = 0;
  acc.lastKeystrokeAt = 0;
}

/**
 * Catat satu keystroke. O(1), nol alokasi.
 *
 * `intervalMs` bernilai null untuk keystroke pertama — ia tidak punya jeda
 * sebelumnya, jadi tidak boleh ikut menghitung mean/stdev (dok. 09 §2, R-18).
 */
export function recordKeystroke(
  acc: Accumulators,
  correct: boolean,
  atMs: number,
  intervalMs: number | null,
): void {
  acc.total += 1;
  if (correct) acc.correct += 1;
  acc.lastKeystrokeAt = atMs;

  if (intervalMs === null) return;

  // Welford: mean & m2 diperbarui tanpa menyimpan sampelnya.
  acc.countInterval += 1;
  const delta = intervalMs - acc.meanInterval;
  acc.meanInterval += delta / acc.countInterval;
  acc.m2Interval += delta * (intervalMs - acc.meanInterval);
}

/** Stdev jeda antar-keystroke. 0 kalau sampelnya belum cukup — bukan NaN. */
export function intervalStdev(acc: Accumulators): number {
  if (acc.countInterval < 2) return 0;
  const variance = acc.m2Interval / (acc.countInterval - 1);
  return variance > 0 ? Math.sqrt(variance) : 0;
}

/**
 * Konsistensi = 1 - (stdev / mean), dijepit ke 0–1 (dok. 03 §4).
 * Butuh minimal 2 jeda; di bawah itu tidak ada informasi, kembalikan 0.
 */
export function consistencyFrom(acc: Accumulators): number {
  if (acc.countInterval < 2 || acc.meanInterval <= 0) return 0;
  const cv = intervalStdev(acc) / acc.meanInterval;
  const value = 1 - cv;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
