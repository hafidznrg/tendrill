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
 * Rekam layout shift. Jalankan, lalu **refresh keras** (Ctrl+Shift+R) supaya
 * pemuatan webfont dari nol ikut terekam — di situlah pergeseran biasanya lahir.
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

  console.log('Merekam layout shift. Refresh keras, pakai halamannya, lalu .stop()');

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

Object.assign(globalThis, { watchCLS, caretCheck });

console.log('Siap. Dua perintah:');
console.log('  const c = watchCLS()   lalu refresh keras, pakai halaman, c.stop()');
console.log('  caretCheck()           ulangi setelah resize dan setelah Ctrl +/-');
