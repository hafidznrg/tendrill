import { describe, expect, it } from 'vitest';
import { generateLetterDrill, generateWordDrill, keyWeights } from '../generator.ts';
import type { KeyUsageMap } from '../generator.ts';

/**
 * Generator berbobot (dok. 09 §4).
 *
 * Yang diuji bukan "keluarannya terlihat wajar" — itu tidak bisa gagal. Yang
 * diuji: panjangnya tepat, tidak ada huruf tiga kali berturut, hanya memakai
 * tombol yang diizinkan, dan **bobot tinggi benar-benar muncul lebih sering**
 * di 10.000 sampel. Yang terakhir itu satu-satunya yang bisa membuktikan
 * rumus dok. 04 §8 benar-benar dipakai, bukan hanya ditulis.
 */

/** LCG kecil: deterministik, jadi kegagalan bisa diulang. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const NEW = ['a', ';'];
const REVIEW = ['f', 'j', 'd', 'k', 's', 'l'];

describe('generateLetterDrill', () => {
  it('menghasilkan panjang yang diminta, tanpa spasi di ujung', () => {
    for (const length of [30, 120, 121, 200]) {
      const text = generateLetterDrill({
        newKeys: NEW,
        reviewKeys: REVIEW,
        length,
        random: seeded(length),
      });
      expect(text).toHaveLength(length);
      expect(text.startsWith(' ')).toBe(false);
      expect(text.endsWith(' ')).toBe(false);
    }
  });

  it('tidak pernah mengulang huruf yang sama tiga kali berturut-turut', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const text = generateLetterDrill({
        newKeys: NEW,
        reviewKeys: REVIEW,
        length: 400,
        random: seeded(seed),
      });
      for (let i = 2; i < text.length; i++) {
        const run = text[i] === text[i - 1] && text[i] === text[i - 2];
        expect(run, `seed ${seed} posisi ${i}: "${text.slice(i - 2, i + 1)}"`).toBe(false);
      }
    }
  });

  it('hanya memakai tombol dari newKeys ∪ reviewKeys (plus spasi)', () => {
    const allowed = new Set([...NEW, ...REVIEW, ' ']);
    const text = generateLetterDrill({
      newKeys: NEW,
      reviewKeys: REVIEW,
      length: 500,
      random: seeded(7),
    });
    for (const char of text) expect(allowed.has(char)).toBe(true);
  });

  it('memotong kata jadi 3–5 huruf, bukan satu aliran tanpa spasi', () => {
    const text = generateLetterDrill({
      newKeys: NEW,
      reviewKeys: REVIEW,
      length: 300,
      random: seeded(11),
    });
    // Kata terakhir boleh terpotong oleh batas panjang; sisanya harus 3–5.
    const words = text.split(' ').slice(0, -1);
    expect(words.length).toBeGreaterThan(10);
    for (const word of words) {
      expect(word.length).toBeGreaterThanOrEqual(3);
      expect(word.length).toBeLessThanOrEqual(5);
    }
  });

  it('Shift di reviewKeys memunculkan kapital, bukan karakter "Shift"', () => {
    const text = generateLetterDrill({
      newKeys: ['Shift'],
      reviewKeys: ['f', 'j'],
      length: 200,
      random: seeded(3),
    });
    expect(text).not.toContain('S');
    expect(/[FJ]/.test(text)).toBe(true);
    expect(/[fj]/.test(text)).toBe(true);
  });

  it('bobot seragam saat keystats kosong (dok. 04 §7)', () => {
    const weights = keyWeights(['f'], ['j'], {});
    expect(weights.get('f')).toBe(2);
    expect(weights.get('j')).toBe(1);
  });
});

/** Frekuensi kemunculan tiap karakter dalam 10.000 sampel. */
function frequencies(stats: KeyUsageMap): Record<string, number> {
  const counts: Record<string, number> = {};
  const random = seeded(99);
  let produced = 0;
  while (produced < 10_000) {
    const text = generateLetterDrill({
      newKeys: [],
      reviewKeys: ['e', 'r', 'u', 'i'],
      length: 200,
      stats,
      random,
    });
    for (const char of text) {
      if (char === ' ') continue;
      counts[char] = (counts[char] ?? 0) + 1;
      produced += 1;
    }
  }
  return counts;
}

describe('pembobotan dari statistik nyata', () => {
  it('error tinggi benar-benar meningkatkan frekuensi kemunculan', () => {
    const stats: KeyUsageMap = {
      e: { attempts: 200, errors: 60, totalMs: 40_000 },
      r: { attempts: 200, errors: 0, totalMs: 40_000 },
      u: { attempts: 200, errors: 0, totalMs: 40_000 },
      i: { attempts: 200, errors: 0, totalMs: 40_000 },
    };
    // 1 + 0.3×3 = 1.9× — jadi "e" harus muncul jelas lebih sering, bukan sekadar
    // "tidak lebih jarang".
    const counts = frequencies(stats);
    expect(counts['e']!).toBeGreaterThan(counts['r']! * 1.5);
  });

  it('latensi tinggi benar-benar meningkatkan frekuensi kemunculan (R-18)', () => {
    const stats: KeyUsageMap = {
      e: { attempts: 100, errors: 0, totalMs: 20_000 }, // 200 ms
      r: { attempts: 100, errors: 0, totalMs: 20_000 },
      u: { attempts: 100, errors: 0, totalMs: 20_000 },
      i: { attempts: 100, errors: 0, totalMs: 50_000 }, // 500 ms → 2.5× (dijepit)
    };
    const counts = frequencies(stats);
    expect(counts['i']!).toBeGreaterThan(counts['e']! * 1.5);
  });

  it('pengali dijepit sesuai dok. 04 §8', () => {
    // Median latensi diambil dari kandidat yang punya data, jadi butuh tiga
    // tombol agar mediannya 100 ms dan rasio x menjadi 10× — cukup untuk
    // menyentuh batas atas 2.5. (Dengan dua tombol, mediannya justru di tengah
    // keduanya dan penjepitnya tidak pernah aktif — itu yang terjadi di versi
    // pertama test ini, dan angkanya terlihat masuk akal.)
    const weights = keyWeights(
      [],
      ['x', 'y', 'z'],
      {
        x: { attempts: 10, errors: 10, totalMs: 10_000 }, // errorRate 1.0, 1000 ms
        y: { attempts: 10, errors: 0, totalMs: 1_000 }, // 100 ms
        z: { attempts: 10, errors: 0, totalMs: 1_000 }, // 100 ms
      },
    );
    // x: 1 × min(4, 1+3) × min(2.5, 1+(1000/100-1)) = 1 × 4 × 2.5 = 10
    expect(weights.get('x')).toBeCloseTo(10, 5);
    expect(weights.get('y')).toBeCloseTo(1, 5);
  });
});

describe('generateWordDrill', () => {
  const pool = ['the', 'and', 'for', 'with', 'that', 'this'];

  it('tidak melebihi panjang target dan tidak memotong kata', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const text = generateWordDrill({
        newKeys: [],
        reviewKeys: ['t', 'h', 'e', 'a', 'n', 'd', 'f', 'o', 'r', 'w', 'i', 's'],
        length: 60,
        pool,
        random: seeded(seed),
      });
      expect(text.length).toBeLessThanOrEqual(60);
      expect(text.length).toBeGreaterThan(30);
      for (const word of text.split(' ')) expect(pool).toContain(word);
    }
  });

  it('memprioritaskan entri yang memuat tombol lemah (dok. 04 §10 langkah 4)', () => {
    const keys = ['t', 'h', 'e', 'a', 'n', 'd', 'f', 'o', 'r', 'w', 'i', 's'];

    /** Porsi kata ber-"w" dari 400 drill. */
    const shareOfW = (stats: KeyUsageMap): number => {
      const random = seeded(5);
      let withW = 0;
      let total = 0;
      for (let i = 0; i < 400; i++) {
        const text = generateWordDrill({
          newKeys: [],
          reviewKeys: keys,
          length: 60,
          pool,
          stats,
          random,
        });
        for (const word of text.split(' ')) {
          total += 1;
          if (word.includes('w')) withW += 1;
        }
      }
      return withW / total;
    };

    const baseline = shareOfW({});
    const weighted = shareOfW({ w: { attempts: 100, errors: 50, totalMs: 20_000 } });

    // Kenaikannya sengaja moderat: bobot entri = RATA-RATA bobot karakternya,
    // jadi satu huruf lemah di dalam kata empat huruf hanya menggeser
    // seperempatnya. Itu memang yang diinginkan — kalau tidak, drill berubah
    // menjadi satu kata yang sama diulang-ulang.
    expect(weighted).toBeGreaterThan(baseline * 1.15);
  });

  it('pool kosong tidak melempar', () => {
    expect(generateWordDrill({ newKeys: [], reviewKeys: ['a'], length: 50, pool: [] })).toBe('');
  });
});
