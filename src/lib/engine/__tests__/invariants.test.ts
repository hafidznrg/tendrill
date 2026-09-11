import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  applyBackspace,
  applyKey,
  computeLiveMetrics,
  computeResult,
  createSession,
  pause,
  resume,
} from '../index.ts';
import { consistencyFrom } from '../accumulators.ts';
import type { SessionState } from '../index.ts';

/**
 * Invarian engine — gerbang wajib dok. 09 §2.1.
 *
 * Ini bukan test "apakah kodenya jalan", melainkan test "apakah kodenya bisa
 * salah". Yang paling penting adalah invarian ketiga: dua jalur perhitungan di
 * dok. 03 §1 (akumulator O(1) vs pemindaian log) wajib sepakat. Tanpa test ini
 * keduanya PASTI menyimpang seiring waktu, dan penyimpangannya senyap.
 */

type Step =
  | { kind: 'key'; char: string; gap: number }
  | { kind: 'backspace' }
  | { kind: 'blur'; gap: number; awayMs: number };

const ALPHABET = 'abcdefg ';

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 8,
    arbitrary: fc.record({
      kind: fc.constant('key' as const),
      char: fc.constantFrom(...ALPHABET.split('')),
      // Selalu di bawah ambang void 30 detik supaya alirannya tetap sah.
      gap: fc.integer({ min: 1, max: 900 }),
    }),
  },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('backspace' as const) }) },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('blur' as const),
      gap: fc.integer({ min: 1, max: 900 }),
      awayMs: fc.integer({ min: 0, max: 120_000 }),
    }),
  },
);

/** Jalankan aliran keystroke acak dan kembalikan sesinya. */
function run(target: string, steps: Step[]): SessionState {
  const s = createSession(target, 40);
  let t = 1000;
  for (const step of steps) {
    if (s.status === 'finished') break;
    if (step.kind === 'key') {
      t += step.gap;
      applyKey(s, step.char, t);
    } else if (step.kind === 'backspace') {
      applyBackspace(s);
    } else {
      t += step.gap;
      pause(s, t);
      t += step.awayMs;
      resume(s, t);
    }
  }
  return s;
}

/** Hitung ulang metrik HANYA dari log — jalur kedua yang harus sepakat. */
function metricsFromLog(s: SessionState) {
  const { log } = s;
  let total = 0;
  let correct = 0;
  const intervals: number[] = [];

  for (let i = 0; i < log.count; i++) {
    total += 1;
    if (log.correct[i] === 1) correct += 1;
    if (i > 0) intervals.push(log.atMs[i]! - log.atMs[i - 1]!);
  }

  const durationMs = log.count === 0 ? 0 : log.atMs[log.count - 1]! - log.atMs[0]!;
  const minutes = durationMs / 60_000;
  const grossWPM = minutes > 0 ? total / 5 / minutes : 0;
  const netWPM = minutes > 0 ? correct / 5 / minutes : 0;
  const accuracy = total === 0 ? 0 : (correct / total) * 100;

  let consistency = 0;
  if (intervals.length >= 2) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean > 0) {
      const variance =
        intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / (intervals.length - 1);
      consistency = Math.min(1, Math.max(0, 1 - Math.sqrt(variance) / mean));
    }
  }

  return { total, correct, durationMs, grossWPM, netWPM, accuracy, consistency };
}

const targetArb = fc.stringMatching(/^[a-g ]+$/).filter((t) => t.length >= 1 && t.length <= 60);

const streamArb = fc.array(stepArb, { minLength: 0, maxLength: 120 });

describe('invarian engine (dok. 09 §2.1)', () => {
  it('0 ≤ accuracy ≤ 100, dan netWPM ≤ grossWPM, selalu', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const r = computeResult(run(target, steps));
        expect(r.accuracy).toBeGreaterThanOrEqual(0);
        expect(r.accuracy).toBeLessThanOrEqual(100);
        expect(r.netWPM).toBeLessThanOrEqual(r.grossWPM + 1e-9);
        expect(r.netWPM).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 400 },
    );
  });

  it('0 ≤ consistency ≤ 1, selalu', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const c = computeResult(run(target, steps)).consistency;
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }),
      { numRuns: 400 },
    );
  });

  it('metrik(akumulator) == metrik(log) — invarian terpenting (R-19)', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const s = run(target, steps);
        // Log yang mentok kapasitas memang sengaja berhenti mencatat detail,
        // jadi perbandingan hanya sah selama ia belum overflow.
        fc.pre(!s.log.overflowed);

        const fromAcc = computeResult(s);
        const fromLog = metricsFromLog(s);

        expect(fromAcc.totalKeystrokes).toBe(fromLog.total);
        expect(fromAcc.correctKeystrokes).toBe(fromLog.correct);
        expect(fromAcc.durationMs).toBeCloseTo(fromLog.durationMs, 6);
        expect(fromAcc.grossWPM).toBeCloseTo(fromLog.grossWPM, 6);
        expect(fromAcc.netWPM).toBeCloseTo(fromLog.netWPM, 6);
        expect(fromAcc.accuracy).toBeCloseTo(fromLog.accuracy, 6);
        expect(fromAcc.consistency).toBeCloseTo(fromLog.consistency, 6);
      }),
      { numRuns: 500 },
    );
  });

  it('tidak pernah menghasilkan NaN atau Infinity', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const s = run(target, steps);
        const r = computeResult(s);
        const live = computeLiveMetrics(s, s.acc.lastKeystrokeAt + 1234);

        for (const n of [
          r.durationMs,
          r.grossWPM,
          r.netWPM,
          r.accuracy,
          r.consistency,
          live.elapsedMs,
          live.grossWPM,
          live.netWPM,
          live.accuracy,
          consistencyFrom(s.acc),
        ]) {
          expect(Number.isFinite(n)).toBe(true);
        }
        for (const v of Object.values(r.latencyByKey)) {
          expect(Number.isFinite(v.sumMs)).toBe(true);
          expect(v.count).toBeGreaterThan(0);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('applyKey tidak pernah mengalokasikan array baru (dirty dipakai ulang)', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const s = createSession(target, 40);
        let seen: number[] | null = null;
        let t = 1000;

        for (const step of steps) {
          if (s.status === 'finished') break;
          let dirty: number[];
          if (step.kind === 'key') {
            t += step.gap;
            dirty = applyKey(s, step.char, t).dirty;
          } else if (step.kind === 'backspace') {
            dirty = applyBackspace(s).dirty;
          } else {
            continue;
          }
          if (seen === null) seen = dirty;
          else expect(dirty).toBe(seen);
          // Satu keystroke menyentuh paling banyak 1 sel (dok. 03 §7).
          expect(dirty.length).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('cursor selalu di dalam rentang, dan cells konsisten dengan cursor', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const s = run(target, steps);
        expect(s.cursor).toBeGreaterThanOrEqual(0);
        expect(s.cursor).toBeLessThanOrEqual(s.target.length);
        // Semua sel di kanan cursor belum diketik.
        for (let i = s.cursor; i < s.cells.length; i++) {
          expect(s.cells[i]!.state).toBe('pending');
          expect(s.cells[i]!.typed).toBeNull();
        }
      }),
      { numRuns: 300 },
    );
  });

  it('pause tidak pernah menambah waktu aktif', () => {
    fc.assert(
      fc.property(targetArb, streamArb, (target, steps) => {
        const s = run(target, steps);
        const r = computeResult(s);
        expect(r.durationMs).toBeGreaterThanOrEqual(0);
        if (s.startedAt !== null) {
          const wallClock = s.acc.lastKeystrokeAt - s.startedAt;
          expect(r.durationMs).toBeLessThanOrEqual(wallClock + 1e-9);
        }
      }),
      { numRuns: 300 },
    );
  });
});
