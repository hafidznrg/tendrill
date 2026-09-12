/**
 * Generator drill berbobot (dok. 04 §8).
 *
 * Pure: tanpa React, tanpa DOM, tanpa storage (dok. 06 §2 batasan 1). Statistik
 * tombol masuk sebagai argumen biasa, bukan dibaca dari `localStorage` — itulah
 * yang membuat "apakah bobotnya benar" bisa diuji tanpa browser sama sekali.
 *
 * Rumusnya mengikat dok. 04 §8:
 *
 *   weight(key) = baseWeight × errorMultiplier × latencyMultiplier
 *   baseWeight        2.0 untuk newKeys, 1.0 untuk reviewKeys
 *   errorMultiplier   1 + errorRate × 3,              dijepit ke [1, 4]
 *   latencyMultiplier 1 + (meanMs / medianMs - 1),    dijepit ke [1, 2.5]
 *
 * `latencyMultiplier` sengaja berentang lebih sempit daripada error: kesalahan
 * tetap lebih penting daripada kelambatan (R-18).
 */

/** Bentuk statistik yang dibutuhkan generator. Sengaja BUKAN tipe storage. */
export interface KeyUsage {
  attempts: number;
  errors: number;
  /** akumulasi latensi menuju tombol ini */
  totalMs: number;
}

export type KeyUsageMap = Record<string, KeyUsage>;

export interface DrillShape {
  /** Tombol yang diperkenalkan lesson ini — bobot dasar 2.0. */
  newKeys: string[];
  /** Tombol lama yang ikut dilatih — bobot dasar 1.0. */
  reviewKeys: string[];
  /** Panjang target karakter. */
  length: number;
  /** Statistik nyata pengguna. Kosong → bobot seragam (dok. 04 §7). */
  stats?: KeyUsageMap;
  /** Sumber acak yang bisa disuntik supaya test deterministik. */
  random?: () => number;
}

export interface WordDrillShape extends DrillShape {
  /** Isi pool wordlist. Generator menyampel dari sini, bukan menyusun huruf. */
  pool: string[];
}

/** Panjang "kata" huruf acak — aliran tanpa spasi tidak melatih ritme (dok. 04 §8). */
const MIN_CHUNK = 3;
const MAX_CHUNK = 5;
/** Batas dok. 04 §8: jangan menghasilkan huruf yang sama tiga kali berturut-turut. */
const MAX_RUN = 2;

const BASE_NEW = 2;
const BASE_REVIEW = 1;

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Karakter yang boleh muncul di drill huruf.
 *
 * `Shift` bukan karakter yang bisa diketik sendiri; ia pseudo-key yang membuka
 * huruf kapital (dok. 04 §15 poin 3). Jadi kehadirannya di `newKeys`/`reviewKeys`
 * menambahkan varian kapital dari huruf yang memang sudah diperkenalkan —
 * bukan menambah karakter `Shift` ke dalam teks.
 */
function charsFor(
  newKeys: string[],
  reviewKeys: string[],
): { chars: string[]; base: Map<string, number> } {
  const base = new Map<string, number>();
  const put = (char: string, weight: number) => {
    const before = base.get(char);
    if (before === undefined || weight > before) base.set(char, weight);
  };

  let shift = false;
  for (const key of newKeys) {
    if (key === 'Shift') shift = true;
    else if (key.length === 1) put(key, BASE_NEW);
  }
  for (const key of reviewKeys) {
    if (key === 'Shift') shift = true;
    else if (key.length === 1) put(key, BASE_REVIEW);
  }

  if (shift) {
    // Setengah bobot huruf kecilnya: kapital ikut dilatih, tapi drill tidak
    // berubah menjadi mayoritas chord Shift — yang justru merusak ritme.
    for (const [char, weight] of [...base]) {
      if (char >= 'a' && char <= 'z') put(char.toUpperCase(), weight / 2);
    }
  }

  return { chars: [...base.keys()], base };
}

/**
 * Bobot final per karakter. Diekspor supaya uji statistik (dok. 09 §4) bisa
 * memeriksa rumusnya langsung, bukan hanya menebaknya dari keluaran.
 */
export function keyWeights(
  newKeys: string[],
  reviewKeys: string[],
  stats: KeyUsageMap = {},
): Map<string, number> {
  const { chars, base } = charsFor(newKeys, reviewKeys);

  // Median latensi diambil dari kandidat yang punya data — bukan dari seluruh
  // keyboard. Pembandingnya harus tombol yang memang sedang dilatih.
  const means: number[] = [];
  for (const char of chars) {
    const stat = stats[char];
    if (stat && stat.attempts > 0 && stat.totalMs > 0) means.push(stat.totalMs / stat.attempts);
  }
  const medianMs = median(means);

  const weights = new Map<string, number>();
  for (const char of chars) {
    const stat = stats[char];
    let weight = base.get(char)!;

    if (stat && stat.attempts > 0) {
      const errorRate = clamp(stat.errors / stat.attempts, 0, 1);
      weight *= clamp(1 + errorRate * 3, 1, 4);

      if (medianMs > 0 && stat.totalMs > 0) {
        const meanMs = stat.totalMs / stat.attempts;
        weight *= clamp(1 + (meanMs / medianMs - 1), 1, 2.5);
      }
    }

    weights.set(char, weight);
  }
  return weights;
}

function pickWeighted(
  entries: Array<[string, number]>,
  total: number,
  random: () => number,
): string {
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1]![0];
}

/**
 * Drill huruf/suku kata berbobot.
 *
 * Panjangnya **tepat** `length` karakter, tanpa spasi di ujung: teks target yang
 * diakhiri spasi memaksa pengguna menekan spasi untuk menyelesaikan sesi, dan
 * itu terbaca sebagai aplikasi yang menggantung.
 */
export function generateLetterDrill(shape: DrillShape): string {
  const { newKeys, reviewKeys, length, stats = {}, random = Math.random } = shape;
  if (length <= 0) return '';

  const weights = keyWeights(newKeys, reviewKeys, stats);
  const entries = [...weights].filter(([, w]) => w > 0);
  if (entries.length === 0) return '';
  const total = entries.reduce((sum, [, w]) => sum + w, 0);

  const out: string[] = [];
  let run = 0;
  let last = '';

  const nextChar = (): string => {
    // Beberapa kali coba lagi; kalau kandidatnya cuma satu huruf, jatuh ke huruf
    // itu daripada berputar tanpa akhir.
    for (let attempt = 0; attempt < 8; attempt++) {
      const char = pickWeighted(entries, total, random);
      if (!(char === last && run >= MAX_RUN)) return char;
    }
    for (const [char] of entries) if (char !== last) return char;
    return entries[0]![0];
  };

  while (out.length < length) {
    if (out.length > 0) {
      out.push(' ');
      run = 0;
      last = ' ';
      if (out.length >= length) break;
    }
    const chunk = MIN_CHUNK + Math.floor(random() * (MAX_CHUNK - MIN_CHUNK + 1));
    for (let i = 0; i < chunk && out.length < length; i++) {
      const char = nextChar();
      run = char === last ? run + 1 : 1;
      last = char;
      out.push(char);
    }
  }

  out.length = length;
  // Potongan bisa berhenti tepat di spasi; ganti dengan huruf supaya panjangnya
  // tetap persis dan ujungnya tetap karakter nyata.
  if (out[length - 1] === ' ') {
    const filler = entries.find(([char]) => char !== out[length - 2])?.[0] ?? entries[0]![0];
    out[length - 1] = filler;
  }
  return out.join('');
}

/**
 * Drill dari wordlist (dok. 04 §15 poin 5).
 *
 * Kata nyata jauh lebih efektif daripada huruf acak (dok. 04 §10 langkah 4),
 * jadi untuk tipe kata/frasa/kalimat generator **menyampel pool**, dan bobot
 * tombol lemah dipakai memilih entri mana yang lebih sering muncul.
 *
 * Panjangnya ≤ `length` dan selalu dipotong di batas kata — memotong kata di
 * tengah membuat drill terasa rusak.
 */
export function generateWordDrill(shape: WordDrillShape): string {
  const { newKeys, reviewKeys, length, pool, stats = {}, random = Math.random } = shape;
  if (length <= 0 || pool.length === 0) return '';

  const weights = keyWeights(newKeys, reviewKeys, stats);
  const entries: Array<[string, number]> = pool.map((entry) => {
    let sum = 0;
    let count = 0;
    for (const char of entry) {
      const w = weights.get(char);
      if (w !== undefined) {
        sum += w;
        count += 1;
      }
    }
    // Rata-rata, bukan jumlah: tanpa itu generator hanya memilih entri terpanjang.
    return [entry, count > 0 ? sum / count : 1];
  });
  const total = entries.reduce((sum, [, w]) => sum + w, 0);

  const parts: string[] = [];
  let used = 0;
  let previous = '';

  for (let guard = 0; guard < pool.length * 64 && used < length; guard++) {
    const entry = pickWeighted(entries, total, random);
    if (entry === previous && pool.length > 1) continue;
    const cost = used === 0 ? entry.length : entry.length + 1;
    if (used + cost > length) {
      // Entri ini tidak muat. Kalau belum ada apa pun, pakai juga — drill kosong
      // lebih buruk daripada drill yang sedikit lebih pendek dari target.
      if (parts.length > 0) break;
      parts.push(entry);
      break;
    }
    parts.push(entry);
    used += cost;
    previous = entry;
  }

  return parts.join(' ');
}
