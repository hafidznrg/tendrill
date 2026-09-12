/**
 * Skrip autotype untuk uji performa (dok. 09 §5).
 *
 * CARA PAKAI: buka layar sesi, buka DevTools Console, tempel SELURUH berkas ini,
 * tekan Enter, lalu jalankan perintah yang dicetak.
 *
 * Sengaja TIDAK memakai `export` / `import`: konsol DevTools mengeksekusi
 * potongan kode sebagai skrip biasa, dan satu kata `export` saja sudah membuat
 * seluruh tempelan gagal dengan "Unexpected token 'export'".
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
/**
 * Ulangi drill dari layar hasil, lalu TUNGGU sampai teksnya benar-benar bersih.
 *
 * **Ini yang salah di versi pertama.** Skrip lama menekan `Tab` untuk mengulang.
 * `Tab` memang me-restart sesi yang sedang BERJALAN, tetapi begitu drill habis
 * sesi masuk `finished` dan layar hasil mengambil alih — di situ tombol ulangi
 * adalah **Enter** (dok. 07 §7). Akibatnya skrip berhenti maju dan menunggu
 * manusia menekan Enter, sementara loop pengukurannya jalan terus.
 */
async function restartFromResult(timeoutMs = 2000) {
  press('Enter');
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    await nextPaint();
    const first = document.querySelector('.ta-text span');
    if (first && first.className === 'ta-pending') return true;
  }
  return false;
}

async function autotype(durationMs = 60_000) {
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
    for (const e of list.getEntries())
      if (e.duration > 50) longTasks.push(+e.duration.toFixed(1));
  });
  try {
    po.observe({ type: 'longtask' });
  } catch {
    console.warn('longtask tidak didukung browser ini');
  }

  if (target.length < 200) {
    console.warn(
      `Teks hanya ${target.length} karakter. Dok. 09 §5 meminta 500 — makin pendek ` +
        'teksnya, makin sering drill selesai dan makin besar porsi frame yang dibuang.',
    );
  }

  // Mulai dari sesi bersih, apa pun keadaan halaman saat skrip dijalankan.
  if (document.querySelector('.rs-root')) await restartFromResult();
  else press('Tab');
  await new Promise((r) => setTimeout(r, 100));

  const t0 = performance.now();
  let i = 0;
  let restarts = 0;
  let dibuangSelesai = 0;
  let dibuangRestart = 0;
  let skipBerikutnya = false;
  let gagalRestart = false;

  while (performance.now() - t0 < durationMs) {
    const posisi = i % target.length;
    const terakhir = posisi === target.length - 1;

    const start = performance.now();
    press(target[posisi]);
    await nextPaint();
    const durasi = performance.now() - start;

    // Dua jenis frame DIBUANG, karena keduanya bukan jalur keystroke:
    //
    // 1. Keystroke penutup drill — ia memicu MOUNT layar hasil. Yang terukur di
    //    situ adalah render satu layar penuh, bukan biaya menekan satu tombol.
    // 2. Keystroke pertama sesudah restart — restart membangun ulang SELURUH
    //    span (perubahan struktural, dok. 03 §6).
    //
    // Versi pertama skrip ini memasukkan keduanya. Pada drill 35 karakter itu
    // berarti ~5,6% sampel teratas adalah frame restart — dan p95 jatuh persis
    // di sana. Yang terbaca sebagai "p95 8,6 ms" sebagian besar adalah biaya
    // mengganti layar, bukan biaya mengetik.
    if (terakhir) dibuangSelesai += 1;
    else if (skipBerikutnya) {
      dibuangRestart += 1;
      skipBerikutnya = false;
    } else samples.push(durasi);

    i += 1;

    if (i % target.length === 0) {
      restarts += 1;
      if (!(await restartFromResult())) {
        gagalRestart = true;
        break;
      }
      skipBerikutnya = true;
    }

    const rest = INTERVAL_MS - (performance.now() - start);
    if (rest > 0) await new Promise((r) => setTimeout(r, rest));
  }

  po.disconnect();

  if (gagalRestart) {
    console.error('Gagal mengulang drill dari layar hasil — pengukuran dihentikan.');
    console.error('Jangan pakai angka apa pun dari jalan ini.');
    return null;
  }

  samples.sort((a, b) => a - b);

  const hasil = {
    keystroke: samples.length,
    detik: +((performance.now() - t0) / 1000).toFixed(1),
    p50: quantile(samples, 0.5),
    p95: quantile(samples, 0.95),
    p99: quantile(samples, 0.99),
    maks: +samples.at(-1).toFixed(2),
    longTasks,
    restarts,
    dibuang: `${dibuangSelesai} selesai + ${dibuangRestart} restart`,
    lulus:
      quantile(samples, 0.95) <= 8 && quantile(samples, 0.99) <= 16 && longTasks.length === 0,
  };

  console.table(hasil);
  return hasil;
}

/**
 * Merekam Event Timing dari input SUNGGUHAN — inilah angka yang diminta DoD.
 *
 * Jalankan, lalu ketik sendiri selama 60 detik, lalu panggil hasil `.stop()`.
 */
function watchRealInput() {
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
async function countDomWork(keystrokes = 50) {
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
    for (const m of list)
      mutations.push(`${m.target.nodeName}:${m.type}:${m.attributeName ?? '-'}`);
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

console.log('Siap. Tiga perintah:');
console.log('  await countDomWork()        mutasi DOM per keystroke (harus 2)');
console.log('  await autotype(60000)       beban 140 WPM 60 detik (tab harus terlihat)');
console.log('  const r = watchRealInput()  lalu ketik sungguhan, lalu r.stop()');
