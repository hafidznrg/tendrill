import type { SessionResult } from '@/lib/engine';
import { FINGER_LABEL, fingerFor } from '@/features/keyboard/fingerMap.ts';

/**
 * Kalimat diagnosis untuk layar hasil (dok. 02 §5 poin 2).
 *
 * Ini bagian layar hasil yang paling menentukan apakah produk ini berguna.
 * Ujinya ada di dok. 09 §8: setelah satu sesi, pengguna harus bisa menjawab
 * "apa satu hal yang perlu kuperbaiki?". Kalau tidak bisa, layar hasil gagal —
 * dan angka WPM sebesar apa pun tidak menebusnya.
 *
 * Nadanya diatur dok. 07 §11: **diagnostik, bukan menghakimi.** "Huruf `y`
 * sering meleset", bukan "kamu buruk di `y`". Tanpa pujian palsu juga —
 * kalimat yang menghibur saat tidak ada yang membaik hanya merusak kepercayaan.
 */

export interface Diagnosis {
  /** Kalimat utama, siap ditampilkan. */
  text: string;
  /** Tombol yang dirujuk, untuk disorot di UI. Kosong kalau tidak spesifik. */
  keys: string[];
}

/** Ambang minimum sebelum sebuah pola layak disebut pola, bukan kebetulan. */
const MIN_CONFUSION_COUNT = 2;
const MIN_LATENCY_SAMPLES = 3;
/** Tombol disebut "lambat" kalau jedanya sekian kali rata-rata sesi. */
const SLOW_RATIO = 1.6;

function fingerPhrase(char: string): string | null {
  const finger = fingerFor(char);
  return finger ? FINGER_LABEL[finger] : null;
}

/** Tampilkan spasi sebagai kata, bukan sebagai karakter tak terlihat. */
function show(char: string): string {
  if (char === ' ') return 'spasi';
  if (char === '\n') return 'enter';
  return char;
}

/**
 * Tombol paling lambat relatif terhadap kecepatan sesi itu sendiri.
 *
 * Relatif, bukan absolut: pengguna 20 WPM dan 60 WPM punya "lambat" yang sangat
 * berbeda, dan ambang tetap akan menuduh pemula melambat di semua tombol.
 */
function slowestKey(result: SessionResult): { char: string; meanMs: number } | null {
  let totalMs = 0;
  let totalCount = 0;
  for (const entry of Object.values(result.latencyByKey)) {
    totalMs += entry.sumMs;
    totalCount += entry.count;
  }
  if (totalCount === 0) return null;

  const sessionMean = totalMs / totalCount;
  if (sessionMean <= 0) return null;

  let worst: { char: string; meanMs: number } | null = null;
  for (const [char, entry] of Object.entries(result.latencyByKey)) {
    if (entry.count < MIN_LATENCY_SAMPLES) continue;
    const mean = entry.sumMs / entry.count;
    if (mean < sessionMean * SLOW_RATIO) continue;
    if (!worst || mean > worst.meanMs) worst = { char, meanMs: mean };
  }
  return worst;
}

/**
 * Satu kalimat, dipilih dari yang paling aktionable.
 *
 * Urutannya sengaja: **kesalahan berpola** lebih berguna daripada kesalahan
 * acak, dan kesalahan acak lebih berguna daripada kelambatan. Pengguna hanya
 * membaca satu kalimat — kalimat itu harus yang paling layak ditindaklanjuti.
 */
export function diagnose(result: SessionResult): Diagnosis {
  if (result.totalKeystrokes === 0) {
    return { text: 'Belum ada yang diketik.', keys: [] };
  }

  // 1. Kebingungan berulang — pola paling jelas dan paling mudah diperbaiki.
  const topConfusion = result.confusions[0];
  if (topConfusion && topConfusion.count >= MIN_CONFUSION_COUNT) {
    const finger = fingerPhrase(topConfusion.expected);
    const tail = finger ? ` — ${finger} bergeser.` : '.';
    return {
      text:
        `Paling sering meleset: \`${show(topConfusion.expected)}\` diketik sebagai ` +
        `\`${show(topConfusion.actual)}\` (${topConfusion.count}×)${tail}`,
      keys: [topConfusion.expected, topConfusion.actual],
    };
  }

  // 2. Kesalahan menumpuk di satu tombol, walau karakter penggantinya berbeda-beda.
  const errorEntries = Object.entries(result.errorsByKey).sort((a, b) => b[1] - a[1]);
  const topError = errorEntries[0];
  if (topError && topError[1] >= MIN_CONFUSION_COUNT) {
    const finger = fingerPhrase(topError[0]);
    const tail = finger ? ` (${finger})` : '';
    return {
      text: `Huruf \`${show(topError[0])}\`${tail} paling sering meleset — ${topError[1]}×.`,
      keys: [topError[0]],
    };
  }

  // 3. Tidak banyak salah, tapi ada tombol yang menahan laju. Inilah yang
  //    mendiagnosis pengguna menengah, dan yang membuka plateau 50→70 WPM (R-18).
  const slow = slowestKey(result);
  if (slow) {
    const finger = fingerPhrase(slow.char);
    const tail = finger ? ` — ${finger} memang paling lambat terbentuk.` : '.';
    return {
      text:
        `Tidak banyak salah, tapi \`${show(slow.char)}\` menahan lajumu: ` +
        `rata-rata ${Math.round(slow.meanMs)} ms${tail}`,
      keys: [slow.char],
    };
  }

  // 4. Benar-benar bersih. Katakan apa adanya, tanpa merayakan berlebihan.
  if (result.accuracy >= 98) {
    return { text: 'Bersih — tidak ada pola kesalahan di sesi ini.', keys: [] };
  }
  return { text: 'Kesalahannya tersebar, belum membentuk pola.', keys: [] };
}

/** Tiga tombol paling bermasalah (dok. 02 §5 poin 4). */
export function topProblemKeys(result: SessionResult, limit = 3): string[] {
  return Object.entries(result.errorsByKey)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([char]) => char);
}
