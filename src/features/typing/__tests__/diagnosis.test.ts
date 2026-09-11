import { describe, expect, it } from 'vitest';
import type { SessionResult } from '@/lib/engine';
import { diagnose, topProblemKeys } from '../diagnosis.ts';

/**
 * Diagnosis (dok. 02 §5, nada dok. 07 §11).
 *
 * Ujinya bukan "apakah stringnya cocok" melainkan "apakah kalimat yang dipilih
 * memang yang paling layak ditindaklanjuti". Karena itu test di bawah menguji
 * URUTAN PRIORITAS, bukan kata per kata.
 */

function makeResult(over: Partial<SessionResult> = {}): SessionResult {
  return {
    target: 'test',
    durationMs: 10_000,
    grossWPM: 40,
    netWPM: 38,
    accuracy: 95,
    totalKeystrokes: 100,
    correctKeystrokes: 95,
    consistency: 0.8,
    errorsByKey: {},
    latencyByKey: {},
    confusions: [],
    logOverflowed: false,
    completedAt: Date.now(),
    ...over,
  };
}

describe('diagnose — prioritas (dok. 02 §5)', () => {
  it('sesi kosong tidak mengarang diagnosis', () => {
    const d = diagnose(makeResult({ totalKeystrokes: 0 }));
    expect(d.text).toBe('Belum ada yang diketik.');
    expect(d.keys).toEqual([]);
  });

  it('kebingungan berulang menang atas segalanya', () => {
    const d = diagnose(
      makeResult({
        confusions: [{ expected: 'e', actual: 'r', count: 5 }],
        errorsByKey: { e: 5, y: 9 },
        latencyByKey: { z: { sumMs: 9000, count: 10 } },
      }),
    );
    expect(d.text).toContain('`e`');
    expect(d.text).toContain('`r`');
    expect(d.text).toContain('5×');
    expect(d.keys).toEqual(['e', 'r']);
  });

  it('menyebut jari yang bergeser, memakai peta jari', () => {
    const d = diagnose(makeResult({ confusions: [{ expected: 'e', actual: 'r', count: 3 }] }));
    // 'e' = tengah kiri (dok. 07 §4)
    expect(d.text).toContain('tengah kiri');
  });

  it('kebingungan satu kali dianggap kebetulan, bukan pola', () => {
    const d = diagnose(
      makeResult({
        confusions: [{ expected: 'e', actual: 'r', count: 1 }],
        errorsByKey: { e: 1 },
      }),
    );
    expect(d.text).not.toContain('diketik sebagai');
  });

  it('kesalahan menumpuk di satu tombol dipakai saat tidak ada pola kebingungan', () => {
    const d = diagnose(
      makeResult({
        confusions: [
          { expected: 'y', actual: 'u', count: 1 },
          { expected: 'y', actual: 't', count: 1 },
        ],
        errorsByKey: { y: 4 },
      }),
    );
    expect(d.text).toContain('`y`');
    expect(d.text).toContain('4×');
    expect(d.keys).toEqual(['y']);
  });

  it('kelambatan dipakai saat nyaris tidak ada kesalahan (R-18)', () => {
    const d = diagnose(
      makeResult({
        accuracy: 97,
        latencyByKey: {
          a: { sumMs: 3000, count: 10 }, // 300 ms — jauh di atas rata-rata
          e: { sumMs: 1000, count: 10 }, // 100 ms
          t: { sumMs: 900, count: 10 }, // 90 ms
        },
      }),
    );
    expect(d.text).toContain('menahan lajumu');
    expect(d.text).toContain('`a`');
    expect(d.keys).toEqual(['a']);
  });

  it('kelambatan diukur RELATIF terhadap sesi, bukan ambang tetap', () => {
    // Pemula: semuanya lambat, tapi seragam → bukan diagnosis kelambatan.
    const d = diagnose(
      makeResult({
        accuracy: 97,
        latencyByKey: {
          a: { sumMs: 5000, count: 10 },
          e: { sumMs: 5100, count: 10 },
          t: { sumMs: 4900, count: 10 },
        },
      }),
    );
    expect(d.text).not.toContain('menahan lajumu');
  });

  it('sampel terlalu sedikit tidak dijadikan diagnosis', () => {
    const d = diagnose(
      makeResult({
        accuracy: 99,
        latencyByKey: {
          q: { sumMs: 2000, count: 2 }, // hanya 2 kemunculan
          e: { sumMs: 1000, count: 10 },
          t: { sumMs: 1000, count: 10 },
        },
      }),
    );
    expect(d.text).not.toContain('`q`');
  });

  it('sesi bersih dinyatakan apa adanya, tanpa pujian berlebihan', () => {
    const d = diagnose(makeResult({ accuracy: 100 }));
    expect(d.text).toBe('Bersih — tidak ada pola kesalahan di sesi ini.');
  });

  it('spasi ditampilkan sebagai kata, bukan karakter tak terlihat', () => {
    const d = diagnose(makeResult({ confusions: [{ expected: ' ', actual: 'n', count: 3 }] }));
    expect(d.text).toContain('`spasi`');
    expect(d.text).not.toContain('` `');
  });
});

describe('topProblemKeys (dok. 02 §5 poin 4)', () => {
  it('mengembalikan tiga tombol terburuk, terurut', () => {
    const keys = topProblemKeys(makeResult({ errorsByKey: { a: 2, b: 9, c: 5, d: 1 } }));
    expect(keys).toEqual(['b', 'c', 'a']);
  });

  it('aman saat tidak ada kesalahan sama sekali', () => {
    expect(topProblemKeys(makeResult())).toEqual([]);
  });
});
