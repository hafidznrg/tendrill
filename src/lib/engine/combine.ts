import type { Confusion, KeyLatency, SessionResult } from './types.ts';

/**
 * Gabungkan beberapa `SessionResult` menjadi satu.
 *
 * Kenapa ini ada: satu lesson punya 3–6 drill yang **dikerjakan berurutan dalam
 * satu sesi** (dok. 04 §2), tetapi engine hanya mengenal satu `target` per sesi.
 * Jadi tiap drill dijalankan sebagai sesi engine sendiri, lalu hasil lesson-nya
 * adalah gabungan ini — dan kriteria kelulusan (dok. 04 §4a) dinilai terhadap
 * gabungan, bukan terhadap drill terakhir. Menilai drill terakhir saja berarti
 * pengguna bisa lulus lesson dengan mengabaikan empat drill pertama.
 *
 * Pure, dan sengaja di dalam engine: rumus WPM hanya boleh hidup di satu tempat.
 */

/** 1 "word" = 5 karakter — sama seperti metrics.ts, dan harus tetap sama. */
const CHARS_PER_WORD = 5;

function wpm(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const value = chars / CHARS_PER_WORD / (elapsedMs / 60_000);
  return Number.isFinite(value) ? value : 0;
}

export function combineResults(results: SessionResult[]): SessionResult | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0]!;

  let durationMs = 0;
  let total = 0;
  let correct = 0;
  let consistencySum = 0;
  let logOverflowed = false;
  const targets: string[] = [];

  const errorsByKey: Record<string, number> = {};
  const latencyByKey: Record<string, KeyLatency> = {};
  const confusionCounts = new Map<string, number>();

  for (const r of results) {
    durationMs += r.durationMs;
    total += r.totalKeystrokes;
    correct += r.correctKeystrokes;
    consistencySum += r.consistency;
    logOverflowed = logOverflowed || r.logOverflowed;
    targets.push(r.target);

    for (const [char, count] of Object.entries(r.errorsByKey)) {
      errorsByKey[char] = (errorsByKey[char] ?? 0) + count;
    }
    for (const [char, entry] of Object.entries(r.latencyByKey)) {
      const before = latencyByKey[char];
      if (before) {
        before.sumMs += entry.sumMs;
        before.count += entry.count;
      } else {
        latencyByKey[char] = { sumMs: entry.sumMs, count: entry.count };
      }
    }
    for (const c of r.confusions) {
      const pair = `${c.expected}>${c.actual}`;
      confusionCounts.set(pair, (confusionCounts.get(pair) ?? 0) + c.count);
    }
  }

  const confusions: Confusion[] = [];
  for (const [pair, count] of confusionCounts) {
    const sep = pair.indexOf('>');
    confusions.push({ expected: pair.slice(0, sep), actual: pair.slice(sep + 1), count });
  }
  confusions.sort((a, b) => b.count - a.count);

  return {
    // Digabung dengan spasi: `target` hanya dipakai untuk panjang & debugging,
    // dan menyambungnya tanpa pemisah akan melahirkan "kata" palsu di ujung drill.
    target: targets.join(' '),
    durationMs,
    grossWPM: wpm(total, durationMs),
    netWPM: wpm(correct, durationMs),
    accuracy: total === 0 ? 0 : (correct / total) * 100,
    totalKeystrokes: total,
    correctKeystrokes: correct,
    // Rata-rata konsistensi per drill. Menghitungnya ulang dari gabungan interval
    // akan menghukum jeda ANTAR drill — jeda itu bukan ketidakkonsistenan mengetik.
    consistency: consistencySum / results.length,
    errorsByKey,
    latencyByKey,
    confusions,
    logOverflowed,
    completedAt: results[results.length - 1]!.completedAt,
  };
}
