/**
 * Pembungkusan baris (dok. 03 §8, R-07).
 *
 * Pembungkusan TIDAK diserahkan ke CSS. Kalau diserahkan, engine tidak tahu
 * row/col dan posisi caret mustahil dihitung tanpa getBoundingClientRect() —
 * yang dilarang di jalur input (dok. 06 §2 batasan 7).
 *
 * Fungsi murni, dihitung sekali per sesi, dites tanpa DOM.
 */

/**
 * Greedy word-wrap. Mengembalikan indeks awal tiap baris; elemen pertama selalu 0.
 *
 * Aturan:
 * - Kata tidak dipotong di tengah, KECUALI kata itu sendiri lebih panjang dari
 *   `cols` — kata seperti itu dipotong keras, karena alternatifnya adalah baris
 *   yang meluber keluar layar dan caret yang meleset.
 * - Spasi di batas baris ikut pada baris sebelumnya, tidak pernah memulai baris
 *   baru. Pengguna tetap harus mengetik spasi itu, dan caretnya harus terlihat.
 * - `\n` di target memaksa baris baru.
 */
export function wrapText(target: string, cols: number): number[] {
  const starts: number[] = [0];
  if (target.length === 0 || cols <= 0) return starts;

  let lineStart = 0;
  let i = 0;

  while (i < target.length) {
    if (target[i] === '\n') {
      i += 1;
      if (i < target.length) {
        starts.push(i);
        lineStart = i;
      }
      continue;
    }

    if (i - lineStart < cols) {
      i += 1;
      continue;
    }

    // Baris penuh. Cari batas kata terakhir supaya kata tidak terpotong.
    let breakAt = -1;
    for (let j = i - 1; j > lineStart; j--) {
      if (target[j] === ' ') {
        breakAt = j + 1; // spasi tetap milik baris sebelumnya
        break;
      }
    }

    // Tidak ada spasi sama sekali di baris ini → kata lebih panjang dari cols,
    // potong keras di batas kolom.
    let next = breakAt === -1 ? i : breakAt;

    // Spasi beruntun di batas baris menggantung di ujung baris sebelumnya,
    // tidak pernah memulai baris baru — baris yang diawali spasi membuat kolom
    // teks terlihat compang-camping dan caretnya menggantung di ruang kosong.
    // Isi kurikulum sendiri sudah dinormalisasi (dok. 03 §10), jadi ini murni
    // jaring pengaman untuk teks latihan bebas.
    if (breakAt !== -1) {
      while (next < target.length && target[next] === ' ') next += 1;
    }

    if (next >= target.length) break;

    starts.push(next);
    lineStart = next;
    i = next < i ? i : next + 1;
  }

  return starts;
}

/** Baris tempat sebuah indeks berada. O(log n). */
export function rowOf(lineStarts: number[], index: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Kolom sebuah indeks di dalam barisnya. */
export function colOf(lineStarts: number[], index: number): number {
  return index - lineStarts[rowOf(lineStarts, index)]!;
}
