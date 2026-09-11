import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { colOf, rowOf, wrapText } from '../wrap.ts';

/** Potong target menjadi baris-baris sesuai lineStarts, untuk diperiksa mata. */
function lines(target: string, starts: number[]): string[] {
  return starts.map((start, i) => target.slice(start, starts[i + 1] ?? target.length));
}

describe('wrapText (dok. 09 §2, R-07)', () => {
  it('teks lebih pendek dari satu baris → satu baris', () => {
    expect(wrapText('halo', 20)).toEqual([0]);
  });

  it('target kosong tidak crash', () => {
    expect(wrapText('', 20)).toEqual([0]);
  });

  it('tidak memotong kata di tengah', () => {
    const target = 'the quick brown fox jumps over the lazy dog';
    const out = lines(target, wrapText(target, 12));
    // Spasi di ujung boleh menggantung; yang tidak boleh adalah KATA melewati cols.
    for (const line of out) expect(line.trimEnd().length).toBeLessThanOrEqual(12);
    // Tiap baris (selain yang terakhir) berakhir di batas kata.
    expect(out.join('')).toBe(target);
    expect(out.every((l) => !l.startsWith(' '))).toBe(true);
  });

  it('satu kata lebih panjang dari cols dipotong keras', () => {
    const target = 'aaaaaaaaaaaaaaa short';
    const starts = wrapText(target, 6);
    expect(starts.length).toBeGreaterThan(1);
    expect(lines(target, starts).join('')).toBe(target);
  });

  it('spasi beruntun di batas baris ikut baris sebelumnya', () => {
    const target = 'abc   def';
    const starts = wrapText(target, 4);
    expect(lines(target, starts).join('')).toBe(target);
    expect(lines(target, starts).every((l) => !l.startsWith(' '))).toBe(true);
  });

  it('newline memaksa baris baru', () => {
    const target = 'a\nb\nc';
    expect(wrapText(target, 40)).toEqual([0, 2, 4]);
  });

  it('rowOf dan colOf konsisten dengan lineStarts', () => {
    const target = 'the quick brown fox jumps over the lazy dog';
    const starts = wrapText(target, 12);
    for (let i = 0; i < target.length; i++) {
      const row = rowOf(starts, i);
      expect(starts[row]!).toBeLessThanOrEqual(i);
      if (starts[row + 1] !== undefined) expect(i).toBeLessThan(starts[row + 1]!);
      expect(colOf(starts, i)).toBe(i - starts[row]!);
    }
  });
});

describe('wrapText — invarian (property)', () => {
  it('lineStarts selalu menaik, mulai 0, dan menutupi seluruh teks', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z .]*$/).filter((s) => s.length <= 200),
        fc.integer({ min: 1, max: 40 }),
        (target, cols) => {
          const starts = wrapText(target, cols);

          expect(starts[0]).toBe(0);
          for (let i = 1; i < starts.length; i++) {
            expect(starts[i]!).toBeGreaterThan(starts[i - 1]!);
          }
          expect(starts[starts.length - 1]!).toBeLessThanOrEqual(
            Math.max(0, target.length - 1),
          );
          expect(lines(target, starts).join('')).toBe(target);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('tidak ada baris melebihi cols kecuali kata tunggal yang memang lebih panjang', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z ]*$/).filter((s) => s.length <= 200),
        fc.integer({ min: 4, max: 40 }),
        (target, cols) => {
          for (const line of lines(target, wrapText(target, cols))) {
            if (line.trimEnd().includes(' '))
              expect(line.trimEnd().length).toBeLessThanOrEqual(cols);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
