/**
 * Skrip autotype untuk uji performa (dok. 09 §5).
 *
 * CARA PAKAI: buka layar sesi, buka DevTools Console, tempel seluruh berkas ini,
 * lalu jalankan `await autotype()`.
 *
 * Wajib dijalankan di **production build** (`npm run build && npm run preview`,
 * atau situs yang sudah di-deploy). Dev build memakai React StrictMode yang
 * memanggil efek dua kali dan modul yang belum diminifikasi — angkanya akan
 * lebih buruk daripada yang benar-benar dialami pengguna.
 *
 * ⚠️ **Yang TIDAK bisa diukur skrip ini: Event Timing API.**
 * `PerformanceObserver` bertipe `event` hanya merekam input yang *trusted* —
 * keydown sintetis tidak pernah muncul di sana. Jadi angka p95 input→paint di
 * DoD Fase 1 tetap harus diambil dari mengetik SUNGGUHAN; pakai `watchRealInput()`
 * di bawah untuk itu. Skrip ini menutup sisi yang lain: beban konstan 140 WPM
 * selama 60 detik, yang tidak bisa dipertahankan tangan manusia.
 */

/* eslint-disable no-console */

const CPM = 700; // 140 WPM × 5 karakter
const INTERVAL_MS = 60_000 / CPM;

function press(key) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function quantile(sorted, p) {
  return +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(2);
}

/**
 * Mengetik pada 140 WPM selama `durationMs`, mengukur dispatch → paint berikutnya.
 *
 * Tab HARUS terlihat di depan: requestAnimationFrame berhenti di tab tersembunyi,
 * dan hasilnya akan tampak "sempurna" karena tidak ada yang pernah dicat.
 */
export async function autotype(durationMs = 60_000) {
  const spans = document.querySelectorAll('.ta-text span');
  if (spans.length === 0) {
    throw new Error('Tidak ada area mengetik di halaman ini. Buka layar sesi dulu.');
  }
  if (document.visibilityState !== 'visible') {
    throw new Error('Tab harus terlihat — rAF berhenti di tab tersembunyi.');
  }

  const target = [...spans].map((s) => s.textContent).join('');
  const samples = [];
  const longTasks = [];

  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.duration > 50) longTasks.push(+e.duration.toFixed(1));
  });
  try {
    po.observe({ type: 'longtask' });
  } catch {
    console.warn('longtask tidak didukung browser ini');
  }

  press('Tab'); // mulai dari sesi bersih
  await new Promise((r) => setTimeout(r, 100));

  const t0 = performance.now();
  let i = 0;

  while (performance.now() - t0 < durationMs) {
    const start = performance.now();
    press(target[i % target.length]);
    await nextPaint();
    samples.push(performance.now() - start);

    i += 1;
    if (i % target.length === 0) press('Tab'); // ulangi teks yang sama

    const rest = INTERVAL_MS - (performance.now() - start);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
  }

  po.disconnect();
  samples.sort((a, b) => a - b);

  const hasil = {
    keystroke: samples.length,
    detik: +((performance.now() - t0) / 1000).toFixed(1),
    p50: quantile(samples, 0.5),
    p95: quantile(samples, 0.95),
    p99: quantile(samples, 0.99),
    maks: +samples.at(-1).toFixed(2),
    longTasks,
    lulus: quantile(samples, 0.95) <= 8 && quantile(samples, 0.99) <= 16 && longTasks.length === 0,
  };

  console.table(hasil);
  return hasil;
}

/**
 * Merekam Event Timing dari input SUNGGUHAN — inilah angka yang diminta DoD.
 *
 * Jalankan, lalu ketik sendiri selama 60 detik, lalu panggil hasil `.stop()`.
 */
export function watchRealInput() {
  const durations = [];

  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.name === 'keydown') durations.push(e.duration);
    }
  });
  // durationThreshold 0 supaya event cepat pun ikut terekam (default 104 ms
  // hanya menangkap yang sudah parah, dan itu bukan yang ingin kita buktikan).
  po.observe({ type: 'event', durationThreshold: 0, buffered: true });

  console.log('Merekam. Ketik seperti biasa, lalu panggil .stop()');

  return {
    stop() {
      po.disconnect();
      if (durations.length === 0) {
        console.warn('Tidak ada entri. Event Timing hanya merekam input sungguhan.');
        return null;
      }
      durations.sort((a, b) => a - b);
      const hasil = {
        keydown: durations.length,
        p50: quantile(durations, 0.5),
        p95: quantile(durations, 0.95),
        p99: quantile(durations, 0.99),
        maks: +durations.at(-1).toFixed(2),
        lulus: quantile(durations, 0.95) <= 8 && quantile(durations, 0.99) <= 16,
      };
      console.table(hasil);
      return hasil;
    },
  };
}

/**
 * Penghitung mutasi DOM per keystroke — bukti "nol pekerjaan React" (R-08).
 *
 * Harapan: **tepat 2 per keystroke** (1 `className` karakter + 1 `transform`
 * caret). Angka yang jauh lebih besar berarti lapisan teks kembali dikelola
 * React — biasanya karena seseorang "merapikan" TypingArea menjadi `cells.map()`.
 */
export async function countDomWork(keystrokes = 50) {
  // Restart DULU, baru catat span-nya. Restart adalah perubahan struktural yang
  // memang membangun ulang seluruh span (itu perilaku yang benar) — mencatat
  // daftar span sebelum restart membuat pengukuran ini melaporkan "span dibuat
  // ulang" pada dirinya sendiri.
  press('Tab');
  await new Promise((r) => setTimeout(r, 80));

  const host = document.querySelector('.ta-root');
  const spans = [...document.querySelectorAll('.ta-text span')];
  const target = spans.map((s) => s.textContent).join('');

  const mutations = [];
  const obs = new MutationObserver((list) => {
    for (const m of list) mutations.push(`${m.target.nodeName}:${m.type}:${m.attributeName ?? '-'}`);
  });
  obs.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });

  // Berhenti sebelum karakter terakhir: menyelesaikan teks memicu layar hasil,
  // dan render-nya akan terhitung sebagai pekerjaan per-keystroke.
  const n = Math.min(keystrokes, target.length - 1);
  for (let i = 0; i < n; i++) press(target[i]);
  await new Promise((r) => setTimeout(r, 50));
  obs.disconnect();

  const spansAfter = [...document.querySelectorAll('.ta-text span')];
  const hasil = {
    keystroke: n,
    mutasiTotal: mutations.length,
    perKeystroke: +(mutations.length / n).toFixed(2),
    spanDibuatUlang: !spans.every((s, i) => s === spansAfter[i]),
    lulus: mutations.length / n <= 2 && spans.every((s, i) => s === spansAfter[i]),
  };

  console.table(hasil);
  return hasil;
}

Object.assign(globalThis, { autotype, watchRealInput, countDomWork });
