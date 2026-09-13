import { describe, expect, it } from 'vitest';
import { pools } from '@/data/wordlists/en';
import {
  ADAPTIVE_LENGTH,
  MIN_SESSIONS,
  adaptiveReadiness,
  buildAdaptiveText,
  vocabularyFrom,
  weakKeys,
  type WeakKey,
} from '../adaptive.ts';
import { defaultKeystats, type KeyStat, type KeystatsData } from '@/lib/storage/schema.ts';

/**
 * Tiga butir DoD Fase 7 (dok. 08), masing-masing dengan kontrol negatif —
 * gerbang yang belum pernah merah belum terbukti menjaga apa pun (CLAUDE.md §2).
 */

/** PRNG deterministik (mulberry32) — tiap test mengulang teks yang sama. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vocabulary = vocabularyFrom([
  pools['common-200']!,
  pools['sentences-basic']!,
  pools['sentences-punct']!,
]);
const vocabSet = new Set(vocabulary);

function stat(attempts: number, errors: number, meanMs: number): KeyStat {
  return { attempts, errors, totalMs: attempts * meanMs, slowCount: 0 };
}

/** Semua huruf rapi: 200 kemunculan, 1% salah, 180 ms. */
function uniformKeys(): Record<string, KeyStat> {
  const keys: Record<string, KeyStat> = {};
  for (let c = 97; c <= 122; c++) keys[String.fromCharCode(c)] = stat(200, 2, 180);
  return keys;
}

function keystatsWith(keys: Record<string, KeyStat>): KeystatsData {
  return { ...defaultKeystats(), keys };
}

/** Profil pengguna nyata: dua tombol sering salah, dua lambat, satu keduanya. */
function weakProfile(): KeystatsData {
  return keystatsWith({
    ...uniformKeys(),
    r: stat(200, 40, 190),
    b: stat(80, 20, 200),
    p: stat(120, 3, 340),
    y: stat(150, 2, 320),
    v: stat(60, 12, 300),
  });
}

function tokens(text: string): string[] {
  return text.split(' ');
}

describe('tombol lemah', () => {
  it('menemukan kelima tombol yang disuntikkan, terburuk lebih dulu', () => {
    const weak = weakKeys(weakProfile());
    expect(weak.map((k) => k.char).sort()).toEqual(['b', 'p', 'r', 'v', 'y']);
    // `v`: salah 20% DAN lambat — skor gabungan harus mengalahkan yang cuma salah satu.
    expect(weak[0]!.char).toBe('v');
  });

  it('kontrol negatif: pengguna yang rapi seragam tidak punya kelemahan', () => {
    expect(weakKeys(keystatsWith(uniformKeys()))).toEqual([]);
  });

  it('A dan a satu tombol — kapital dilipat', () => {
    const keys = uniformKeys();
    keys['a'] = stat(6, 0, 180);
    keys['A'] = stat(6, 3, 180); // sendiri-sendiri < 10, gabungannya 12 dan 25% salah
    expect(weakKeys(keystatsWith(keys)).map((k) => k.char)).toContain('a');
  });
});

describe('DoD 1 — drill didominasi tombol lemah', () => {
  const weak = weakKeys(weakProfile());
  const weakChars = new Set(weak.map((k) => k.char));

  function share(text: string): { words: number; letters: number } {
    const ts = tokens(text);
    const letters = text.replace(/ /g, '');
    return {
      words: ts.filter((t) => [...t].some((c) => weakChars.has(c))).length / ts.length,
      letters: [...letters].filter((c) => weakChars.has(c)).length / letters.length,
    };
  }

  it('≥ 70% token tiap drill memuat tombol lemah, dan hurufnya ≥ 2× porsi di teks biasa', () => {
    let adaptiveLetters = 0;
    let plainLetters = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const adaptive = share(buildAdaptiveText({ weak, vocabulary, random: seeded(seed) }));
      // Pembanding: kosakata yang sama, tanpa tombol lemah = teks "latihan bebas".
      const plain = share(buildAdaptiveText({ weak: [], vocabulary, random: seeded(seed) }));
      expect(adaptive.words).toBeGreaterThanOrEqual(0.7);
      adaptiveLetters += adaptive.letters;
      plainLetters += plain.letters;
    }
    // Rata-rata, bukan per drill: `r` sudah umum di bahasa Inggris, jadi satu
    // drill 200 karakter bisa jatuh dekat ambang karena kebetulan.
    expect(adaptiveLetters).toBeGreaterThanOrEqual(plainLetters * 2);
  });

  it('kontrol negatif: teks tanpa tombol lemah GAGAL ambang yang sama', () => {
    const plain = share(buildAdaptiveText({ weak: [], vocabulary, random: seeded(3) }));
    expect(plain.words).toBeLessThan(0.7);
  });

  it('kelima tombol mendapat giliran, bukan hanya yang terburuk', () => {
    const text = Array.from({ length: 5 }, (_, i) =>
      buildAdaptiveText({ weak, vocabulary, random: seeded(100 + i) }),
    ).join(' ');
    for (const c of weakChars) expect(text).toContain(c);
  });
});

describe('DoD 2 — bisa diketik dengan wajar', () => {
  const weak = weakKeys(weakProfile());

  it('kata nyata, dipisah satu spasi, tanpa tiga huruf sama berturut-turut', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const text = buildAdaptiveText({ weak, vocabulary, random: seeded(seed) });
      expect(text.length).toBeGreaterThan(ADAPTIVE_LENGTH * 0.8);
      expect(text.length).toBeLessThanOrEqual(ADAPTIVE_LENGTH);
      expect(text).toMatch(/^[a-z]+( [a-z]+)*$/);
      expect(text).not.toMatch(/(.)\1\1/);
      const ts = tokens(text);
      // Kelima tombol profil ini punya ≥ 3 kata, jadi seluruhnya kata nyata.
      expect(ts.every((t) => vocabSet.has(t))).toBe(true);
      // Tidak mengulang kata yang sama tepat sesudahnya.
      for (let i = 1; i < ts.length; i++) expect(ts[i]).not.toBe(ts[i - 1]);
    }
  });

  it('tombol tanpa kata nyata (z, q, x, j) jatuh ke suku kata konsonan-vokal, bukan huruf acak', () => {
    const rare: WeakKey[] = ['z', 'q', 'x', 'j'].map((char) => ({
      char,
      score: 2,
      attempts: 20,
      errorRate: 20,
      meanMs: 300,
    }));
    const text = buildAdaptiveText({ weak: rare, vocabulary, random: seeded(7) });
    for (const t of tokens(text)) {
      if (vocabSet.has(t)) continue;
      expect(t).toMatch(/^([zqxj][aeiou][tnsrlmd]|[tnsrlmd][aeiou][zqxj])$/);
    }
    expect(text).toContain('z'); // `z` tidak ada di kosakata sama sekali
  });
});

describe('DoD 3 — tidak crash saat statistik masih sedikit', () => {
  it('belum 5 sesi → belum siap, dengan alasannya', () => {
    expect(adaptiveReadiness(MIN_SESSIONS - 1, weakProfile())).toEqual({
      ready: false,
      reason: 'sessions',
      sessions: MIN_SESSIONS - 1,
    });
  });

  it('keystats kosong → belum siap karena tombol, bukan melempar', () => {
    expect(adaptiveReadiness(50, defaultKeystats())).toMatchObject({
      ready: false,
      reason: 'keys',
    });
  });

  it('semua tombol < 10 kemunculan tidak dinilai, sekalipun 100% salah', () => {
    const keys: Record<string, KeyStat> = {};
    for (const c of 'asdfjkl') keys[c] = stat(9, 9, 900);
    expect(weakKeys(keystatsWith(keys))).toEqual([]);
  });

  it('tepat 10 kemunculan sudah dinilai', () => {
    expect(weakKeys(keystatsWith({ a: stat(10, 5, 200) })).map((k) => k.char)).toEqual(['a']);
  });

  it('data rusak (NaN, negatif, bukan huruf) tidak menghasilkan NaN', () => {
    const keys = {
      a: { attempts: NaN, errors: 3, totalMs: 100, slowCount: 0 },
      b: { attempts: 30, errors: -4, totalMs: Infinity, slowCount: 0 },
      c: stat(30, 9, 200),
      ';': stat(90, 60, 900),
      Shift: stat(90, 60, 900),
    } as Record<string, KeyStat>;
    const weak = weakKeys(keystatsWith(keys));
    expect(weak.map((k) => k.char)).toEqual(['c']);
    for (const k of weak) {
      expect(Number.isFinite(k.score) && Number.isFinite(k.meanMs)).toBe(true);
    }
  });

  it('generator tahan masukan kosong', () => {
    expect(buildAdaptiveText({ weak: [], vocabulary: [] })).toBe('');
    expect(
      buildAdaptiveText({ weak: weakKeys(weakProfile()), vocabulary: [], random: seeded(1) }),
    ).toMatch(/^[a-z ]+$/);
    expect(buildAdaptiveText({ weak: [], vocabulary, length: 0 })).toBe('');
  });
});
