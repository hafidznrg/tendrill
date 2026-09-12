/**
 * Uji layout shift & presisi caret (dok. 09 §5, R-06).
 *
 * CARA PAKAI: buka layar sesi, buka DevTools Console, tempel SELURUH berkas ini,
 * tekan Enter, lalu jalankan perintah yang dicetak.
 *
 * Sengaja TIDAK memakai `export` / `import` — sama seperti `perf-autotype.js`,
 * satu kata `export` membuat seluruh tempelan gagal di konsol.
 *
 * Kenapa ini skrip, bukan one-liner di chat: one-liner versi pertama untuk caret
 * **crash** begitu drill diselesaikan (indeks kursor melewati span terakhir, lalu
 * `undefined.getBoundingClientRect()`). Alat ukur pantas diperlakukan seperti kode:
 * ditulis sekali, diuji, dipakai berulang.
 */

/* eslint-disable no-console */

/**
 * Laporkan layout shift yang SUDAH terjadi sejak halaman dimuat. Ini yang
 * biasanya kamu mau.
 *
 * **Tidak perlu dipasang sebelum refresh.** `buffered: true` membuat observer
 * menerima entri yang lahir SEBELUM ia dibuat — jadi urutannya: refresh keras
 * dulu, pakai halamannya, baru tempel skrip ini dan panggil `clsSekarang()`.
 * (Instruksi "jalankan dulu, baru refresh" yang sempat beredar keliru: refresh
 * memang menghapus semua yang ditempel di konsol, dan itu tidak perlu dilawan.)
 */
async function clsSekarang() {
  let cls = 0;
  const shifts = [];
  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      cls += e.value;
      shifts.push({
        nilai: +e.value.toFixed(5),
        sumber: (e.sources ?? [])
          .map(
            (x) =>
              (x.node?.nodeName ?? '?') + (x.node?.className ? '.' + x.node.className : ''),
          )
          .slice(0, 3),
      });
    }
  });
  po.observe({ type: 'layout-shift', buffered: true });
  // Satu putaran event loop supaya entri ter-buffer sempat dikirim.
  await new Promise((r) => setTimeout(r, 50));
  po.disconnect();

  const hasil = {
    cls: +cls.toFixed(5),
    jumlahShift: shifts.length,
    shifts,
    lulus: cls < 0.001,
  };
  console.table({ cls: hasil.cls, jumlahShift: hasil.jumlahShift, lulus: hasil.lulus });
  if (shifts.length > 0) console.table(shifts);
  return hasil;
}

/**
 * Rekam layout shift yang terjadi MULAI SEKARANG — untuk menguji interaksi
 * tertentu (mis. munculnya layar hasil) tanpa tercampur pergeseran saat muat.
 */
function watchCLS() {
  let cls = 0;
  const shifts = [];

  const po = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      // `hadRecentInput` menandai pergeseran yang dipicu interaksi pengguna
      // sendiri (mis. mengetik). Itu bukan layout shift yang dikeluhkan.
      if (e.hadRecentInput) continue;
      cls += e.value;
      const sumber = (e.sources ?? [])
        .map((s) => s.node?.nodeName + (s.node?.className ? '.' + s.node.className : ''))
        .slice(0, 3);
      shifts.push({ nilai: +e.value.toFixed(5), sumber });
      console.warn('shift!', +e.value.toFixed(5), sumber);
    }
  });
  po.observe({ type: 'layout-shift', buffered: true });

  console.log('Merekam layout shift mulai sekarang. Panggil .stop() untuk menutup.');

  return {
    stop() {
      po.disconnect();
      const hasil = {
        cls: +cls.toFixed(5),
        jumlahShift: shifts.length,
        shifts,
        // Anggaran dok. 07 §1 poin 2: nol. Ambang di bawah 0,001 diperlakukan
        // sebagai nol karena pembulatan sub-piksel bisa menghasilkan nilai debu.
        lulus: cls < 0.001,
      };
      console.table({ cls: hasil.cls, jumlahShift: hasil.jumlahShift, lulus: hasil.lulus });
      if (!hasil.lulus) console.table(shifts);
      return hasil;
    },
  };
}

/**
 * Presisi caret (R-06).
 *
 * Posisi caret dihitung **aritmetika** (`kolom × charWidth`), tidak pernah diukur
 * dari DOM (dok. 06 §2 batasan 7). Konsekuensinya: kalau `charWidth` meleset
 * sedikit saja, melesetnya **menumpuk** makin ke kanan. Karena itu yang diperiksa
 * di sini bukan hanya posisi caret sekarang, melainkan **kolom terjauh di setiap
 * baris** — di situlah akumulasi error paling besar dan paling terlihat.
 *
 * Jalankan setelah `document.fonts.ready`, lalu ulangi setelah resize dan zoom.
 */
function caretCheck() {
  const text = document.querySelector('.ta-text');
  const spans = [...document.querySelectorAll('.ta-text span')];
  if (!text || spans.length === 0) {
    console.warn('Tidak ada area mengetik di halaman ini. Buka layar sesi dulu.');
    return null;
  }

  // Diukur dari elemen yang SAMA dengan tempat span hidup — mengukur dari elemen
  // contoh terpisah berisiko font atau letter-spacing berbeda.
  const probe = document.createElement('span');
  probe.textContent = 'M'.repeat(50);
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
  text.appendChild(probe);
  const charWidth = probe.getBoundingClientRect().width / 50;
  probe.remove();

  const baris = new Map();
  for (const sp of spans) {
    const r = sp.getBoundingClientRect();
    const y = Math.round(r.y);
    if (!baris.has(y)) baris.set(y, []);
    baris.get(y).push(r.x);
  }

  let meleset = 0;
  let melesetDi = null;
  for (const [y, xs] of baris) {
    const x0 = xs[0];
    xs.forEach((x, kolom) => {
      const d = Math.abs(x - (x0 + kolom * charWidth));
      if (d > meleset) {
        meleset = d;
        melesetDi = { baris: y, kolom };
      }
    });
  }

  const caret = document.querySelector('.ta-caret');
  const kursor = spans.filter((s) => s.className !== 'ta-pending').length;
  const diUjung = kursor >= spans.length;
  const sasaran = spans[Math.min(kursor, spans.length - 1)];
  const selisihCaret =
    caret && sasaran
      ? +(caret.getBoundingClientRect().x - sasaran.getBoundingClientRect().x).toFixed(2)
      : null;

  const hasil = {
    charWidth: +charWidth.toFixed(3),
    fonts: document.fonts?.status ?? 'tidak didukung',
    kolomTerjauhMeleset: +meleset.toFixed(3),
    melesetDi,
    // Saat drill sudah habis, caret berdiri sesudah karakter terakhir — selisih
    // terhadap span terakhir memang besar dan TIDAK berarti apa-apa. Karena itu
    // ia tidak ikut menentukan kelulusan di kondisi itu.
    selisihCaret,
    diUjungTeks: diUjung,
    lulus: meleset < 1 && (diUjung || Math.abs(selisihCaret ?? 0) < 1),
  };

  console.table(hasil);
  return hasil;
}

Object.assign(globalThis, { clsSekarang, watchCLS, caretCheck });

console.log('Siap. Tiga perintah:');
console.log('  await clsSekarang()   shift sejak halaman dimuat — tempel SESUDAH refresh');
console.log('  const c = watchCLS()  shift mulai sekarang; c.stop() untuk menutup');
console.log('  caretCheck()          ulangi setelah resize dan setelah Ctrl +/-');
console.log('');
console.log('Konsol dibersihkan tiap refresh. Supaya tidak menempel ulang:');
console.log('  DevTools → Sources → Snippets → New snippet → tempel → Ctrl+Enter.');
