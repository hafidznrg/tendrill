import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyKey, combineResults, computeResult, createSession } from '../index.ts';
import type { SessionResult } from '../types.ts';

/**
 * Penggabungan hasil beberapa drill menjadi satu hasil lesson.
 *
 * Yang dijaga di sini adalah **kejujuran angkanya**: gabungan harus sama dengan
 * menghitung seluruh keystroke sebagai satu aliran, bukan rata-rata dari
 * rata-rata. Rata-rata dari rata-rata akan memberi drill 12 karakter bobot yang
 * sama dengan drill 200 karakter — dan kelulusan lesson dinilai dari angka ini.
 */

/** Satu drill yang diketik dengan jeda tetap; `wrong` = indeks yang disalahkan. */
function playDrill(target: string, gapMs: number, wrong: Set<number>): SessionResult {
  const s = createSession(target, 80);
  const start = 1_000;
  for (let i = 0; i < target.length; i++) {
    const expected = target[i]!;
    const typed = wrong.has(i) ? (expected === 'x' ? 'y' : 'x') : expected;
    applyKey(s, typed, start + i * gapMs);
  }
  return computeResult(s);
}

describe('combineResults', () => {
  it('satu hasil dikembalikan apa adanya', () => {
    const one = playDrill('ff jj ff', 100, new Set());
    expect(combineResults([one])).toBe(one);
  });

  it('daftar kosong → null, bukan hasil palsu berisi nol', () => {
    expect(combineResults([])).toBeNull();
  });

  it('keystroke dan akurasi dijumlahkan, bukan dirata-ratakan', () => {
    const a = playDrill('aaaaaaaaaa', 100, new Set([0])); // 10 ketuk, 1 salah
    const b = playDrill('bbbbbbbbbbbbbbbbbbbb', 100, new Set()); // 20 ketuk, 0 salah
    const combined = combineResults([a, b])!;

    expect(combined.totalKeystrokes).toBe(30);
    expect(combined.correctKeystrokes).toBe(29);
    // 29/30 = 96,67% — BUKAN rata-rata (90% + 100%)/2 = 95%.
    expect(combined.accuracy).toBeCloseTo((29 / 30) * 100, 6);
  });

  it('durasi dijumlahkan, dan WPM dihitung dari total — bukan dirata-ratakan', () => {
    const a = playDrill('aaaaaaaaaa', 100, new Set());
    const b = playDrill('bbbbbbbbbb', 500, new Set());
    const combined = combineResults([a, b])!;

    expect(combined.durationMs).toBeCloseTo(a.durationMs + b.durationMs, 6);
    const expectedGross =
      combined.totalKeystrokes / 5 / (combined.durationMs / 60_000);
    expect(combined.grossWPM).toBeCloseTo(expectedGross, 6);
    expect(combined.netWPM).toBeLessThanOrEqual(combined.grossWPM);
  });

  it('error, latensi, dan confusion per tombol digabung', () => {
    const a = playDrill('xxxx', 100, new Set([1]));
    const b = playDrill('xxxx', 100, new Set([2]));
    const combined = combineResults([a, b])!;

    expect(combined.errorsByKey['x']).toBe(2);
    expect(combined.latencyByKey['x']!.count).toBe(
      a.latencyByKey['x']!.count + b.latencyByKey['x']!.count,
    );
    expect(combined.confusions[0]).toMatchObject({ expected: 'x', actual: 'y', count: 2 });
  });

  it('confusion diurutkan dari yang paling sering', () => {
    const a = playDrill('aaaa', 100, new Set([0, 1, 2]));
    const b = playDrill('bb', 100, new Set([0]));
    const combined = combineResults([a, b])!;
    const counts = combined.confusions.map((c) => c.count);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
  });

  it('invarian tetap berlaku untuk gabungan acak', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            length: fc.integer({ min: 1, max: 40 }),
            gapMs: fc.integer({ min: 50, max: 900 }),
            errorCount: fc.integer({ min: 0, max: 40 }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (specs) => {
          const results = specs.map((spec) => {
            const wrong = new Set<number>();
            for (let i = 0; i < Math.min(spec.errorCount, spec.length); i++) wrong.add(i);
            return playDrill('x'.repeat(spec.length), spec.gapMs, wrong);
          });
          const combined = combineResults(results)!;

          expect(combined.netWPM).toBeLessThanOrEqual(combined.grossWPM + 1e-9);
          expect(combined.accuracy).toBeGreaterThanOrEqual(0);
          expect(combined.accuracy).toBeLessThanOrEqual(100);
          expect(combined.correctKeystrokes).toBeLessThanOrEqual(combined.totalKeystrokes);
          expect(Number.isFinite(combined.netWPM)).toBe(true);
          expect(Number.isFinite(combined.consistency)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
