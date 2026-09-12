import { describe, expect, it } from 'vitest';
import {
  CEILING_WPM,
  DURATIONS,
  FULL_LENGTH,
  SOURCES,
  buildPracticeText,
  targetLengthFor,
} from '../practice.ts';
import { pools } from '@/data/wordlists/en';

/**
 * Aturan pembangkitan teks latihan bebas (ADR-032).
 *
 * Yang dijaga di sini bukan "teksnya bagus" melainkan satu janji yang bisa
 * dilanggar tanpa terlihat: **teks mode timer harus lebih panjang daripada yang
 * bisa diketik siapa pun dalam durasinya.** Sekali ia lebih pendek, sesi
 * berakhir karena teksnya habis, dan "15 detik" diam-diam berhenti berarti 15
 * detik.
 */

/** Sumber acak deterministik — test yang memakai Math.random adalah test yang berbeda tiap hari. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('panjang target', () => {
  it('diturunkan dari 200 WPM, bukan angka bulat yang enak dilihat', () => {
    expect(targetLengthFor(15_000)).toBe(250);
    expect(targetLengthFor(30_000)).toBe(500);
    expect(targetLengthFor(60_000)).toBe(1000);
  });

  it('"sampai selesai" memakai panjang tetap', () => {
    expect(targetLengthFor(null)).toBe(FULL_LENGTH);
  });

  it('lebih panjang daripada yang bisa diketik pengetik tercepat sekalipun', () => {
    for (const d of DURATIONS) {
      if (d.limitMs === null) continue;
      const reachable = (d.limitMs / 60_000) * CEILING_WPM * 5;
      expect(targetLengthFor(d.limitMs)).toBeGreaterThanOrEqual(reachable);
    }
  });
});

describe('buildPracticeText', () => {
  it('mengisi mendekati panjang target untuk setiap sumber', () => {
    for (const source of SOURCES) {
      const pool = pools[source.pool];
      expect(pool, `pool ${source.pool} harus ada`).toBeDefined();

      const text = buildPracticeText(pool!, 30_000, seeded(7));
      expect(text.length).toBeLessThanOrEqual(500);
      // Longgar 1 entri terpanjang: generator berhenti di batas kata, tidak
      // pernah memotong di tengah.
      const longest = Math.max(...pool!.map((e) => e.length));
      expect(text.length).toBeGreaterThan(500 - longest - 1);
    }
  });

  it('hanya memakai entri dari pool-nya sendiri', () => {
    const pool = pools['numbers-symbols']!;
    const text = buildPracticeText(pool, 15_000, seeded(3));
    // Pool angka & simbol memuat entri ber-spasi ("2 * 6 = 12"), jadi memecah
    // per spasi tidak sah. Yang diperiksa: seluruh karakternya memang berasal
    // dari pool, bukan huruf yang diselundupkan generator.
    const allowed = new Set([...pool.join(' ')]);
    for (const char of text) expect(allowed.has(char)).toBe(true);
  });

  it('deterministik untuk seed yang sama', () => {
    const pool = pools['common-200']!;
    expect(buildPracticeText(pool, 15_000, seeded(11))).toBe(
      buildPracticeText(pool, 15_000, seeded(11)),
    );
  });

  it('pool kosong tidak membuatnya crash', () => {
    expect(buildPracticeText([], 15_000, seeded(1))).toBe('');
  });
});
