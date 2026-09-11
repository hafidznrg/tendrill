import { consistencyFrom } from './accumulators.ts';
import type {
  Confusion,
  KeyLatency,
  LiveMetrics,
  SessionResult,
  SessionState,
} from './types.ts';

/**
 * Perhitungan metrik (dok. 03 §4).
 *
 * Dua jalur, sengaja dipisah (dok. 03 §1 "Aturan emas"):
 * - `computeLiveMetrics` — O(1) dari akumulator, dipanggil tiap 250 ms.
 * - `computeResult` — O(n) memindai log, dipanggil SEKALI di akhir sesi.
 *
 * Keduanya wajib menghasilkan angka identik di akhir sesi. Itu bukan harapan,
 * melainkan property test (dok. 09 §2.1) — tanpa itu keduanya pasti menyimpang.
 */

/** 1 "word" = 5 karakter, standar industri agar sebanding dengan app lain. */
const CHARS_PER_WORD = 5;

const EMPTY_METRICS: LiveMetrics = {
  elapsedMs: 0,
  grossWPM: 0,
  netWPM: 0,
  accuracy: 0,
  progress: 0,
};

/** Jangan pernah biarkan NaN/Infinity sampai ke UI (dok. 03 §4). */
function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function wpm(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return finite(chars / CHARS_PER_WORD / (elapsedMs / 60_000));
}

/** Waktu aktif: keystroke pertama → terakhir, dikurangi waktu pause. */
export function activeElapsedMs(s: SessionState, nowMs?: number): number {
  if (s.startedAt === null) return 0;
  const until = nowMs ?? s.acc.lastKeystrokeAt;
  const elapsed = until - s.startedAt - s.pausedMs;
  return elapsed > 0 ? elapsed : 0;
}

/**
 * Metrik live — O(1), murni dari akumulator, nol alokasi selain objek hasil
 * (dipanggil 4×/detik, bukan per keystroke).
 */
export function computeLiveMetrics(s: SessionState, nowMs: number): LiveMetrics {
  const { acc } = s;
  if (acc.total === 0 || s.startedAt === null) {
    return { ...EMPTY_METRICS, progress: s.cursor };
  }

  // Selama pause, waktu beku di titik pause — bukan terus berjalan.
  const until = s.status === 'paused' && s.pausedAt !== null ? s.pausedAt : nowMs;
  const elapsedMs = activeElapsedMs(s, until);

  return {
    elapsedMs,
    grossWPM: wpm(acc.total, elapsedMs),
    netWPM: wpm(acc.correct, elapsedMs),
    accuracy: finite((acc.correct / acc.total) * 100),
    progress: s.cursor,
  };
}

/**
 * Hasil akhir — memindai log sekali (dok. 03 §9).
 *
 * Log adalah sumber kebenaran untuk analisis error; akumulator hanya jalur cepat
 * untuk angka live. Di sini keduanya bertemu dan wajib sepakat.
 */
export function computeResult(s: SessionState): SessionResult {
  const { acc, log } = s;
  const durationMs = activeElapsedMs(s);
  const total = acc.total;
  const correct = acc.correct;

  const errorsByKey: Record<string, number> = {};
  const latencyByKey: Record<string, KeyLatency> = {};
  const confusionCounts = new Map<string, number>();

  for (let i = 0; i < log.count; i++) {
    const expected = String.fromCharCode(log.expectedCode[i]!);
    const isCorrect = log.correct[i] === 1;

    if (!isCorrect) {
      // Dihitung per karakter TARGET, bukan karakter yang diketik — pertanyaan
      // yang berguna adalah "tombol mana yang sering kamu lewatkan".
      errorsByKey[expected] = (errorsByKey[expected] ?? 0) + 1;
      const actual = String.fromCharCode(log.actualCode[i]!);
      const pair = `${expected}>${actual}`;
      confusionCounts.set(pair, (confusionCounts.get(pair) ?? 0) + 1);
    }

    // Latensi = jeda MENUJU tombol ini. Keystroke pertama tidak punya jeda
    // sebelumnya, jadi ia tidak ikut dihitung (R-18).
    if (i > 0) {
      const gap = log.atMs[i]! - log.atMs[i - 1]!;
      const entry = latencyByKey[expected];
      if (entry) {
        entry.sumMs += gap;
        entry.count += 1;
      } else {
        latencyByKey[expected] = { sumMs: gap, count: 1 };
      }
    }
  }

  const confusions: Confusion[] = [];
  for (const [pair, count] of confusionCounts) {
    const sep = pair.indexOf('>');
    confusions.push({
      expected: pair.slice(0, sep),
      actual: pair.slice(sep + 1),
      count,
    });
  }
  confusions.sort((a, b) => b.count - a.count);

  return {
    target: s.target,
    durationMs,
    grossWPM: wpm(total, durationMs),
    netWPM: wpm(correct, durationMs),
    accuracy: total === 0 ? 0 : finite((correct / total) * 100),
    totalKeystrokes: total,
    correctKeystrokes: correct,
    consistency: consistencyFrom(acc),
    errorsByKey,
    latencyByKey,
    confusions,
    logOverflowed: log.overflowed,
    completedAt: Date.now(),
  };
}
