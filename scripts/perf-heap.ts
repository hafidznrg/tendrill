/**
 * Gerbang "nol alokasi heap per keystroke" (dok. 09 §5, ADR-021).
 *
 * Dulu item ini dibaca dengan mata di Chrome Memory allocation profiler. Ia tidak
 * butuh browser sama sekali: engine wajib murni Node (dok. 06 §2 batasan 1), jadi
 * pertumbuhan heap di sepanjang jalur keystroke bisa diukur langsung — dan diukur
 * ULANG tiap commit, bukan sekali seumur proyek.
 *
 * **Cara mengukurnya penting, dan versi pertama skrip ini salah.** Membandingkan
 * `heapUsed` di antara dua `gc()` mengukur memori yang DITAHAN, bukan yang
 * DIALOKASIKAN — dan alokasi per keystroke yang normal justru berumur pendek,
 * sehingga `gc()` terakhir menghapus persis bukti yang dicari. Kontrol negatif
 * (menyisipkan `sink.push({ i })` di dalam loop) lolos begitu saja.
 *
 * Yang dipakai sekarang: `gc()` sekali di awal, lalu `heapUsed` SESUDAH loop tanpa
 * gc apa pun, sehingga sampah transien masih terhitung. Ronde yang kejatuhan GC di
 * tengah jalan dibuang — angkanya tidak bisa dipercaya.
 *
 * Jalankan lewat `npm run perf:heap` (butuh flag `--expose-gc`).
 */

import { PerformanceObserver } from 'node:perf_hooks';
import { applyKey, createSession, restartSession } from '../src/lib/engine/session.ts';

/** Sengaja 500 karakter: panjang drill terburuk menurut dok. 03 §6. */
const TARGET_LEN = 500;
const ROUNDS = 16;
const MIN_VALID_ROUNDS = 4;

/**
 * Ambang longgar dengan sengaja. Yang dikejar bukan "berapa byte", melainkan
 * "apakah ada yang tumbuh SEBANDING dengan jumlah keystroke". Satu objek kosong
 * saja berumur ~32 byte, jadi alokasi per keystroke akan menembus ini dengan mudah.
 */
const MAX_BYTES_PER_KEYSTROKE = 8;

function buildTarget(): string {
  const alphabet = 'asdfjkl; ghruein';
  let out = '';
  for (let i = 0; i < TARGET_LEN; i++) out += alphabet[i % alphabet.length];
  return out;
}

function main(): void {
  if (typeof gc !== 'function') {
    console.error('perf-heap: butuh --expose-gc. Jalankan lewat `npm run perf:heap`.');
    process.exit(1);
  }

  let gcCount = 0;
  const observer = new PerformanceObserver(() => {
    gcCount++;
  });
  observer.observe({ entryTypes: ['gc'] });

  const target = buildTarget();
  // Karakter dipecah DULU: `target[i]` mengalokasikan string satu karakter, dan
  // itu alokasi milik harness yang akan salah dibebankan ke engine.
  const chars: string[] = [];
  for (let i = 0; i < target.length; i++) chars.push(target[i]!);

  const session = createSession(target, 60);

  // Pemanasan: biarkan JIT selesai dan buffer log tumbuh ke ukuran tetapnya.
  for (let r = 0; r < 5; r++) {
    restartSession(session);
    for (let i = 0; i < chars.length; i++) applyKey(session, chars[i]!, 1000 + i * 60);
  }

  const deltas: number[] = [];
  let discarded = 0;

  for (let r = 0; r < ROUNDS; r++) {
    restartSession(session);
    gc!();
    const gcBefore = gcCount;
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < chars.length; i++) applyKey(session, chars[i]!, 1000 + i * 60);

    // TANPA gc() — justru sampah transien yang harus ikut terhitung.
    const after = process.memoryUsage().heapUsed;

    if (gcCount !== gcBefore) {
      // GC menyapu di tengah pengukuran: selisihnya tidak berarti apa-apa.
      discarded++;
      continue;
    }
    deltas.push((after - before) / chars.length);
  }

  observer.disconnect();

  if (deltas.length < MIN_VALID_ROUNDS) {
    console.error(
      `perf-heap: GAGAL — hanya ${deltas.length} ronde valid dari ${ROUNDS} ` +
        `(${discarded} kejatuhan GC). Pengukuran tidak bisa disimpulkan.`,
    );
    process.exit(1);
  }

  // MINIMUM lintas ronde: tiap ronde bisa kejatuhan alokasi dari luar engine
  // (timer Node, buffer I/O). Alokasi yang benar-benar per-keystroke muncul di
  // SETIAP ronde, jadi ia bertahan di angka minimum.
  const best = Math.min(...deltas);
  const rounded = +best.toFixed(2);

  console.log(`perf-heap: ${rounded} byte/keystroke (ambang ${MAX_BYTES_PER_KEYSTROKE})`);
  console.log(
    `  ${deltas.length} ronde valid × ${chars.length} keystroke` +
      (discarded > 0 ? ` · ${discarded} dibuang karena GC` : '') +
      `\n  ronde: ${deltas.map((d) => d.toFixed(1)).join(', ')}`,
  );

  if (best > MAX_BYTES_PER_KEYSTROKE) {
    console.error(
      `perf-heap: GAGAL — jalur keystroke mengalokasikan ${rounded} byte/keystroke.\n` +
        '  Cari objek/array/string yang dibuat di dalam applyKey atau yang dipanggilnya.',
    );
    process.exit(1);
  }
}

main();
