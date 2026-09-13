import { keyWeights, type KeyUsageMap } from '@/lib/engine';
import type { KeystatsData } from '@/lib/storage/schema.ts';

/**
 * Latihan adaptif (dok. 04 §10, dok. 08 Fase 7, ADR-034) — **pure**.
 *
 * Tanpa React, tanpa storage, tanpa mengimpor wordlist: statistik dan kosakata
 * masuk sebagai argumen. Sama seperti `practice.ts`, itulah yang membuat
 * halamannya bisa memuat chunk `wordlists` secara lazy sementara aturannya
 * tetap bisa dites di Node murni.
 *
 * Dua keputusan yang membedakannya dari `generateWordDrill`:
 *
 * 1. **Skor tombol lemah memakai rumus generator yang sama** (`keyWeights`,
 *    dok. 04 §8): error × latensi, latensi relatif terhadap median pengguna
 *    sendiri. Tidak ada rumus kedua yang bisa menyimpang.
 * 2. **Kata dipilih PER TOMBOL, bukan dirata-rata per kata.** `generateWordDrill`
 *    memberi tiap entri rata-rata bobot hurufnya, sehingga satu huruf lemah di
 *    kata lima huruf nyaris tidak menggeser peluangnya — drill-nya tidak pernah
 *    benar-benar didominasi tombol lemah (dok. 08 Fase 7 DoD butir 1).
 */

/** dok. 04 §10: adaptif baru masuk akal setelah ≥ 5 sesi tersimpan. */
export const MIN_SESSIONS = 5;
/** dok. 04 §10 & dok. 07 §9: tombol < 10 kemunculan terlalu sedikit dipercaya. */
export const MIN_KEY_OCCURRENCES = 10;
/** dok. 04 §10: lima tombol dengan skor gabungan terburuk. */
export const WEAK_KEY_COUNT = 5;
/**
 * Skor minimum untuk disebut "lemah". Skor 1 = tidak ada kesalahan dan tidak
 * lebih lambat dari median. Tanpa ambang, tombol yang 1% lebih lambat dari
 * median sudah disebut kelemahan — derau dibaca sebagai diagnosis, alasan yang
 * sama dengan pita heatmap yang dibulatkan ke bawah (ADR-033). 1,15 ≈ 5% salah,
 * atau 15% lebih lambat dari median.
 */
export const MIN_WEAK_SCORE = 1.15;
/** Panjang drill — batas atas dok. 04 §8 (120–200 karakter). */
export const ADAPTIVE_LENGTH = 200;
/**
 * Porsi slot yang sengaja menyasar tombol lemah. Sisanya kata acak dari
 * kosakata — "huruf frekuensi tinggi sebagai pengisi" (dok. 04 §10 langkah 3)
 * datang sendiri dari kata umum, dan memberi jari jeda dari tombol yang sulit.
 */
export const WEAK_SLOT_SHARE = 0.8;
/**
 * Tombol dengan kata nyata lebih sedikit dari ini dilatih lewat suku kata.
 * Satu-dua kata saja membuat drill mengulang kata yang sama belasan kali.
 */
export const MIN_WORDS_PER_KEY = 3;

export interface WeakKey {
  /** huruf kecil; `A` dilipat ke `a` — yang dilatih jarinya, bukan Shift */
  char: string;
  /** `keyWeights` dengan bobot dasar 1: errorMultiplier × latencyMultiplier */
  score: number;
  attempts: number;
  /** 0–100 */
  errorRate: number;
  meanMs: number;
}

export type AdaptiveReadiness =
  | { ready: true; weak: WeakKey[] }
  | { ready: false; reason: 'sessions' | 'keys'; sessions: number };

function finite(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * `keystats` per karakter → statistik per HURUF kecil.
 *
 * Hanya `a–z`: kosakata latihan adaptif adalah kata Inggris, jadi tombol angka
 * dan simbol tidak punya kata untuk dilatih. Itu batasan yang disadari (ADR-034),
 * bukan kelalaian — heatmap `/stats` tetap menampilkannya.
 */
export function letterStats(keystats: KeystatsData): KeyUsageMap {
  const out: KeyUsageMap = {};
  for (const [raw, stat] of Object.entries(keystats.keys ?? {})) {
    const char = raw.toLowerCase();
    if (char.length !== 1 || char < 'a' || char > 'z') continue;
    const acc = out[char] ?? { attempts: 0, errors: 0, totalMs: 0 };
    acc.attempts += finite(stat?.attempts);
    acc.errors += finite(stat?.errors);
    acc.totalMs += finite(stat?.totalMs);
    out[char] = acc;
  }
  return out;
}

/** Tombol terlemah, terburuk lebih dulu. Kosong kalau tidak ada yang menonjol. */
export function weakKeys(keystats: KeystatsData, count = WEAK_KEY_COUNT): WeakKey[] {
  const stats = letterStats(keystats);
  const eligible = Object.keys(stats).filter((c) => stats[c]!.attempts >= MIN_KEY_OCCURRENCES);
  if (eligible.length === 0) return [];

  // Median latensi dihitung `keyWeights` dari kandidat ini saja — tombol yang
  // datanya terlalu sedikit tidak ikut menggeser acuan.
  const onlyEligible: KeyUsageMap = {};
  for (const c of eligible) onlyEligible[c] = stats[c]!;
  const weights = keyWeights([], eligible, onlyEligible);

  return eligible
    .map((char): WeakKey => {
      const s = stats[char]!;
      return {
        char,
        score: weights.get(char) ?? 1,
        attempts: s.attempts,
        errorRate: Math.min(100, (s.errors / s.attempts) * 100),
        meanMs: s.totalMs / s.attempts,
      };
    })
    .filter((k) => Number.isFinite(k.score) && k.score >= MIN_WEAK_SCORE)
    .sort(
      (a, b) => b.score - a.score || b.errorRate - a.errorRate || (a.char < b.char ? -1 : 1),
    )
    .slice(0, count);
}

/**
 * Alasan singkat sebuah tombol disebut lemah. Tombol yang lemah karena LAMBAT
 * bukan "0% salah" — kalimat itu terbaca sebagai pujian (dok. 07 §11).
 */
export function weakKeyLabel(k: WeakKey): string {
  return k.errorRate >= 1
    ? `${Math.round(k.errorRate)}% salah`
    : `lambat · ${Math.round(k.meanMs)} ms`;
}

export function adaptiveReadiness(sessions: number, keystats: KeystatsData): AdaptiveReadiness {
  if (!(sessions >= MIN_SESSIONS)) return { ready: false, reason: 'sessions', sessions };
  const weak = weakKeys(keystats);
  if (weak.length === 0) return { ready: false, reason: 'keys', sessions };
  return { ready: true, weak };
}

/**
 * Kosakata dari pool wordlist: kata unik huruf kecil, ≥ 2 huruf, `a–z` saja.
 * Kalimat ikut dipecah — ia menambah kata yang tidak ada di 200 kata teratas.
 */
export function vocabularyFrom(pools: readonly (readonly string[])[]): string[] {
  const words = new Set<string>();
  for (const pool of pools) {
    for (const entry of pool) {
      // Tanda baca di tepi dibuang, tapi kata yang MEMUAT tanda baca (`haven't`)
      // dilewati utuh — memecahnya melahirkan "kata" `haven` dan `ve`.
      for (const raw of entry.toLowerCase().split(/\s+/)) {
        const word = raw.replace(/^[^a-z]+|[^a-z]+$/g, '');
        if (word.length >= 2 && /^[a-z]+$/.test(word)) words.add(word);
      }
    }
  }
  return [...words].sort();
}

const VOWELS = 'aeiou';
const CONSONANTS = 'tnsrlmd';

/**
 * Suku kata tiga huruf yang memuat `char` — jalan keluar untuk tombol yang
 * hampir tidak punya kata nyata (`j`, `q`, `x`, `z`). Selalu konsonan-vokal
 * bergantian supaya bisa "diucapkan" dalam kepala: `jat` jauh lebih mudah
 * diketik berirama daripada `jxq`.
 */
export function syllableFor(char: string, random: () => number): string {
  const pick = (from: string) => from[Math.floor(random() * from.length)]!;
  if (VOWELS.includes(char)) return `${pick(CONSONANTS)}${char}${pick(CONSONANTS)}`;
  return random() < 0.5
    ? `${char}${pick(VOWELS)}${pick(CONSONANTS)}`
    : `${pick(CONSONANTS)}${pick(VOWELS)}${char}`;
}

export interface AdaptiveShape {
  weak: readonly WeakKey[];
  vocabulary: readonly string[];
  length?: number;
  random?: () => number;
}

/**
 * Teks latihan adaptif. Panjang ≤ `length`, dipotong di batas kata, tanpa
 * spasi di ujung. Tidak pernah melempar: tanpa tombol lemah atau tanpa
 * kosakata, ia jatuh ke kata umum atau string kosong.
 */
export function buildAdaptiveText(shape: AdaptiveShape): string {
  const { weak, vocabulary, length = ADAPTIVE_LENGTH, random = Math.random } = shape;
  if (length <= 0) return '';

  const targets = weak.filter((k) => k.char.length === 1 && k.score > 0);
  const total = targets.reduce((sum, k) => sum + k.score, 0);
  const weakSet = new Set(targets.map((k) => k.char));
  // Per tombol: kata yang memuatnya, masing-masing berbobot 1 + jumlah huruf
  // lemah di dalamnya. `every` (e, v, r, y) lebih berharga daripada `very`
  // hanya kalau ia memang melatih lebih banyak tombol lemah, bukan karena panjang.
  const byChar = new Map<string, { words: string[]; weights: number[]; total: number }>();
  for (const k of targets) {
    const words = vocabulary.filter((w) => w.includes(k.char));
    const weights = words.map((w) => 1 + [...w].filter((c) => weakSet.has(c)).length);
    byChar.set(k.char, { words, weights, total: weights.reduce((s, x) => s + x, 0) });
  }

  const pickFrom = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const pickWord = ({
    words,
    weights,
    total: sum,
  }: {
    words: string[];
    weights: number[];
    total: number;
  }) => {
    let roll = random() * sum;
    for (let i = 0; i < words.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) return words[i]!;
    }
    return words[words.length - 1]!;
  };

  const nextToken = (): string | null => {
    if (targets.length > 0 && (vocabulary.length === 0 || random() < WEAK_SLOT_SHARE)) {
      // Tombol dipilih berbobot skor: yang paling lemah paling sering, tapi
      // kelima tombol tetap mendapat giliran.
      let roll = random() * total;
      let target = targets[targets.length - 1]!;
      for (const k of targets) {
        roll -= k.score;
        if (roll <= 0) {
          target = k;
          break;
        }
      }
      const entry = byChar.get(target.char)!;
      return entry.words.length >= MIN_WORDS_PER_KEY
        ? pickWord(entry)
        : syllableFor(target.char, random);
    }
    return vocabulary.length > 0 ? pickFrom(vocabulary) : null;
  };

  const parts: string[] = [];
  let used = 0;
  let previous = '';
  for (let guard = 0; guard < length * 8 && used < length; guard++) {
    const token = nextToken();
    if (token === null) break;
    if (token === previous) continue;
    const cost = used === 0 ? token.length : token.length + 1;
    if (used + cost > length) {
      if (parts.length > 0) break;
      continue;
    }
    parts.push(token);
    used += cost;
    previous = token;
  }
  return parts.join(' ');
}
