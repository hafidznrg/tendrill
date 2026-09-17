import { generateWordDrill } from '@/lib/engine';
import type { PracticeMode } from '@/lib/storage/schema.ts';

/**
 * Aturan latihan bebas (dok. 02 §6, ADR-032) — **pure**.
 *
 * Sengaja tanpa React, tanpa storage, dan **tanpa mengimpor wordlist**: pool
 * masuk sebagai argumen. Itu yang membuat `/practice` bisa memuat chunk
 * `wordlists` secara lazy (dok. 06 §6) sementara aturannya tetap bisa dites di
 * Node murni.
 */

export interface PracticeDuration {
  id: PracticeMode;
  label: string;
  /** null = "sampai selesai": sesi berakhir saat teksnya habis. */
  limitMs: number | null;
}

export const DURATIONS: readonly PracticeDuration[] = [
  { id: '15s', label: '15 detik', limitMs: 15_000 },
  { id: '30s', label: '30 detik', limitMs: 30_000 },
  { id: '60s', label: '60 detik', limitMs: 60_000 },
  { id: 'full', label: 'sampai selesai', limitMs: null },
];

export type PracticeSourceId = 'words' | 'sentences' | 'punctuation' | 'numbers';

export interface PracticeSource {
  id: PracticeSourceId;
  label: string;
  /** Kunci di `pools` (`src/data/wordlists/en`). */
  pool: string;
  /** Satu baris bahasa UI: apa isi pool-nya. Wajib cocok dengan datanya. */
  hint: string;
}

/**
 * Empat sumber teks. "kutipan" di dok. 02 v1 menjadi "kalimat" (ADR-032): pool
 * kutipan tidak pernah ditulis, dan memasukkan kutipan orang lain menyeret
 * pertanyaan lisensi yang dok. 04 §13 sengaja hindari.
 */
export const SOURCES: readonly PracticeSource[] = [
  {
    id: 'words',
    label: 'kata umum',
    pool: 'common-200',
    hint: '200 kata bahasa Inggris paling sering',
  },
  {
    id: 'sentences',
    label: 'kalimat',
    pool: 'sentences-basic',
    hint: 'kalimat utuh — kapital, koma, titik',
  },
  {
    id: 'punctuation',
    label: 'kalimat bertanda baca',
    pool: 'sentences-punct',
    hint: 'tanda kutip, tanya, seru, titik dua, apostrof',
  },
  {
    id: 'numbers',
    label: 'angka & simbol',
    pool: 'numbers-symbols',
    hint: 'tahun, harga, persen, simbol umum',
  },
];

/**
 * Kecepatan atap untuk menghitung panjang teks (ADR-032).
 *
 * Bukan tebakan nyaman: rekor sustained dunia ada di bawah angka ini, jadi
 * target sepanjang ini menjamin mode timer berakhir karena **waktunya** habis.
 */
export const CEILING_WPM = 200;

/** Panjang teks mode "sampai selesai" — kira-kira satu paragraf. */
export const FULL_LENGTH = 240;

const CHARS_PER_WORD = 5;

export function targetLengthFor(limitMs: number | null): number {
  if (limitMs === null) return FULL_LENGTH;
  return Math.ceil((limitMs / 60_000) * CEILING_WPM * CHARS_PER_WORD);
}

export function durationById(id: PracticeMode): PracticeDuration {
  return DURATIONS.find((d) => d.id === id) ?? DURATIONS[1]!;
}

export function sourceById(id: PracticeSourceId): PracticeSource {
  return SOURCES.find((s) => s.id === id) ?? SOURCES[0]!;
}

/**
 * Bangkitkan teks latihan dari sebuah pool.
 *
 * Memakai generator yang sama dengan kurikulum (dok. 04 §8) dengan daftar
 * tombol **kosong**, sehingga seluruh entri berbobot sama. Latihan bebas memang
 * tidak menargetkan tombol tertentu — yang adaptif baru datang di Fase 7, dan
 * menyelundupkannya ke sini sekarang akan membuat "latihan bebas" diam-diam
 * tidak bebas.
 */
export function buildPracticeText(
  pool: readonly string[],
  limitMs: number | null,
  random: () => number = Math.random,
): string {
  return generateWordDrill({
    newKeys: [],
    reviewKeys: [],
    length: targetLengthFor(limitMs),
    pool: [...pool],
    random,
  });
}
