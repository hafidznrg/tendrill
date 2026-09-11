/**
 * Prefetch jalur sesi (dok. 06 §6).
 *
 * Peta chunk menaruh engine dan layar sesi di jalur yang harus siap lebih dulu,
 * karena prinsip produk #1 adalah "keystroke pertama < 3 detik". Tetapi
 * memasukkannya ke bundel awal berarti pengunjung `/stats` ikut mengunduhnya
 * secara BLOKIR.
 *
 * Prefetch saat idle menyelesaikan keduanya: byte-nya tetap sampai lebih dulu,
 * tetapi tidak pernah menunda render pertama. Ini mekanisme yang memang sudah
 * ditetapkan dok. 06 §6 untuk `unit-1` ("awal (prefetch)"); di sini ia dipakai
 * untuk layar sesi juga.
 */

let started = false;

export function prefetchSessionPath(): void {
  if (started) return;
  started = true;

  const run = () => {
    // Kegagalan prefetch tidak boleh terlihat oleh pengguna — ini murni
    // optimasi, dan rute aslinya tetap akan memuat chunk-nya sendiri.
    void import('@/pages/LessonPage').catch(() => {});
    void import('@/data/curriculum/en/lessons/unit-1.ts').catch(() => {});
  };

  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  if (ric) ric(run);
  else setTimeout(run, 1200);
}
