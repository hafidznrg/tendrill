# 08 — Roadmap & Definition of Done

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

Estimasi berbasis kerja solo part-time (2–4 jam/hari). Fase dikerjakan berurutan;
**jangan mulai fase berikutnya sebelum DoD fase saat ini terpenuhi.**

> **Catatan revisi v2 (R-23).** Tiga perubahan urutan, semuanya untuk satu tujuan:
> **mengungkap risiko terbesar lebih awal.**
> 1. Storage layer naik ke ekor Fase 1 — Fase 2 dan seterusnya membutuhkannya.
> 2. Kurikulum naik ke Fase 3, dan **uji ke pemula nyata dipindah ke ~hari 11** (dari hari 25).
>    Risiko terbesar proyek ini bukan kode, melainkan apakah kurikulumnya benar-benar mengajar.
> 3. Penulisan konten dilepas dari jalur kritis — nol ketergantungan pada kode, jadi dicicil
>    sebagai pekerjaan latar sejak hari pertama.

---

## Pekerjaan latar — dimulai hari 1, dikerjakan di sela

Penulisan konten kurikulum (dok. 04 §13) **tidak bergantung pada kode sama sekali**.
v1 menyerialkannya di dalam Fase 4 dan kehilangan tiga hari dari jalur kritis.

Kerjakan di hari bertenaga rendah, sedikit demi sedikit:
teks placement, 30 lesson, kurasi wordlist, 100+ kalimat, panduan postur.
**Target: konten Unit 0–1 selesai sebelum Fase 3 dimulai.**

---

## Fase 0 — Fondasi · ~1 hari

Setup Vite + React + TS + Tailwind, ESLint/Prettier, Vitest, struktur folder sesuai dok. 06,
routing kosong untuk 6 halaman, token tema (terang/gelap), gerbang anggaran bundel di CI.

**DoD** — **selesai 2026-09-11**
- [x] `npm run dev`, `build`, `test`, `lint` semuanya jalan tanpa error
- [x] 6 rute bisa dinavigasi, masing-masing sebagai chunk terpisah (R-11)
- [x] Toggle tema terang/gelap berfungsi (persisten, tanpa kedipan saat muat)
- [x] TypeScript `strict` menyala, nol error
- [x] CI menggagalkan build kalau bundel awal > 90 KB gzip

> **Catatan penutup Fase 0.** Gerbang anggaran langsung menangkap pelanggaran pertamanya:
> `createBrowserRouter` membuat bundel awal 103,8 KB. Diganti router deklaratif (ADR-017),
> sekarang **86,9 / 90 KB gzip**. Margin tersisa ~3 KB — engine Fase 1 harus masuk ke
> sana, jadi periksa `npm run budget` sebelum menambah dependensi apa pun.
>
> Di luar DoD, ikut dikerjakan karena Fase 1 bergantung padanya: font di-host sendiri
> (JetBrains Mono variabel + IBM Plex Sans, subset latin) supaya pengukuran `charWidth`
> setelah `document.fonts.ready` (R-06) mengukur face yang benar sejak awal.

---

## Fase 1 — Typing Engine + Storage · ~4,5 hari  ⭐ fase paling kritikal

Implementasi `src/lib/engine/` lengkap sesuai dok. 03 v2: log kolumnar, akumulator Welford,
`KeyOutcome`, pause/void, `wrapText`. Plus `useTypingSession` dan `TypingArea` minimal
(teks + caret + status karakter, lapisan imperatif).

**Ekor fase (~0,5 hari): storage layer** sesuai dok. 05. Kecil, tapi membuka semua fase
berikutnya — di v1 ia terjebak di Fase 3 sehingga Fase 2 tidak bisa diuji secara nyata.

**DoD** — kode selesai 2026-09-11; tiga item performa menunggu verifikasi manual
- [x] Unit test engine lulus; semua kasus tepi dok. 03 §10 punya test
- [x] **Property test lulus**: `netWPM ≤ grossWPM`, `0 ≤ accuracy ≤ 100`,
      dan **metrik(akumulator) == metrik(log)** (R-19) — 500 aliran acak per invarian
- [x] Golden fixture terpasang dan hijau (`fixtures/session-01.json`)
- [ ] **Nol alokasi heap per keystroke** — *belum diverifikasi Chrome Memory profiler.*
      Yang sudah ada: buffer typed-array dialokasikan sekali, array `dirty` dipakai
      ulang, dan property test menegakkan identitasnya tidak pernah berubah.
- [x] **Nol re-render React per keystroke** — diukur di browser: **tepat 2 mutasi DOM
      per keystroke** (1 `className` karakter + 1 `transform` caret) dan identitas
      seluruh span tidak berubah. *React Profiler sendiri belum dijalankan.*
- [ ] Mengetik 140 WPM sintetis selama 60 detik: **p95 input→paint ≤ 8 ms**
      (Event Timing API), nol long task — *belum.* Yang terukur: biaya **sinkron**
      jalur keystroke atas 2000 keystroke beruntun di dev build — p95 **0,1 ms**,
      p99 0,2 ms, maks 2,3 ms. Lapang terhadap anggaran 8 ms, tetapi paint belum
      ikut terukur dan Event Timing butuh input sungguhan.
- [x] Backspace, Tab, Esc, key repeat, blur/pause, void 30 detik sesuai spesifikasi
- [x] Paste terblokir termasuk `Shift+Insert` dan drag-drop
- [x] Storage: baca rusak, kuota penuh (4 tingkat pemangkasan), versi lama, mode memori

> **Titik henti wajib.** Setelah fase ini, pakai sendiri 15 menit. Kalau ada yang terasa
> "berat" atau "meleset", perbaiki **sekarang** — bukan nanti.
>
> **DITUNDA ke titik henti Fase 2 (keputusan pemilik, 2026-09-11).** Tiga verifikasi
> di atas butuh tangan manusia di Chrome DevTools (Memory allocation profiler, React
> Profiler, Event Timing dengan input sungguhan), plus 15 menit memakai sendiri.
>
> Fase 2 dimulai lebih dulu. **Utangnya tidak hilang, hanya dipindah**: ia sekarang
> menjadi syarat DoD Fase 2, dan justru lebih berat di sana karena virtual keyboard
> baru menyala — itulah kasus terburuk yang memang diminta dok. 09 §5, dan yang di
> Fase 1 belum bisa diuji karena keyboardnya belum ada.
>
> **Risiko yang diterima:** kalau ternyata ada yang meleset, yang harus dibongkar
> bukan lagi engine saja melainkan engine + layar sesi lengkap.

---

## Fase 2 — Layar sesi lengkap · ~3 hari

Metrik live (rAF bergerbang 250 ms), layar hasil dengan diagnosis, virtual keyboard +
panduan jari + highlight tombol berikutnya, gulir teks per baris, restart cepat,
penyimpanan hasil saat idle.

**DoD**
- [x] Metrik live akurat dibanding hitungan manual — `sessionFlow.test.tsx`
- [ ] Layar hasil menampilkan kalimat diagnosis yang bermakna — *penilaian manusia,
      tidak bisa diotomasi; `diagnosis.test.ts` hanya menjaga ia tidak kosong/salah*
- [x] Virtual keyboard menyorot tombol berikutnya termasuk Shift sisi berlawanan —
      `fingerMap.test.ts` + `VirtualKeyboard.test.tsx`
- [ ] Nol layout shift saat mengetik; caret tetap presisi setelah webfont termuat
      dan setelah resize/zoom (R-06) — *manual: `layout-shift` butuh paint, dan panel
      otomasi tidak menggambar.* Diukur `scripts/perf-layout.js`. **Dua sumber sudah
      ditutup, satu tersisa:**
      - ✅ scrollbar lahir saat layar hasil muncul, menggeser halaman **−7,6 px** —
        `scrollbar-gutter: stable`
      - ✅ `.ta-root` lahir setinggi **0 px** lalu melompat 129,6 px karena tingginya
        diturunkan dari `lineHeight` yang bernilai 0 sampai font siap — **CLS 0,0497**.
        Tinggi kini dari CSS, dan prop `lineHeight` dicabut dari `TypingArea`
      - ✅ nav bergeser **0,00035** saat webfont menggantikan fallback — fallback
        kini ber-`size-adjust: 109,1296%` sehingga advance-nya identik dengan
        JetBrains Mono (ADR-023); selisih sisa 0,2 px di baris penuh 52 kolom
      - ✅ caret: **0 meleset di 35 kolom** setelah `fonts.ready` dan setelah resize;
        zoom browser belum diuji
- [x] Sesi tersimpan setelah selesai, nol penulisan saat berjalan —
      `sessionFlow.test.tsx` + `persistSession.test.ts`
- [x] Seluruh alur sesi bisa dijalankan tanpa mouse — `sessionFlow.test.tsx`

**Utang Fase 1 yang jatuh tempo di sini** (ditunda 2026-09-11, lihat catatan Fase 1).
Dua di antaranya **selesai dan sekarang dijaga `npm run verify`**, bukan diperiksa
sekali (ADR-021):
- [x] Nol alokasi heap per keystroke — `npm run perf:heap`. Tidak lagi lewat Chrome
      Memory profiler. **Gerbang ini langsung menemukan pelanggaran nyata**:
      `_dirty.length = 0` mengalokasikan 152 byte/keystroke lewat pemangkasan backing
      store V8. Diperbaiki; sekarang 0,5 byte = lantai pengukuran.
- [x] Nol re-render per keystroke — `rerender.test.tsx`, memakai `<Profiler>` dari
      paket `react` (bukan ekstensi DevTools), dengan virtual keyboard menyala.
      Tepat 2 commit per sesi, keduanya transisi status.
- [x] `autotype()` **dengan virtual keyboard menyala** — kasus terburuk dok. 09 §5.
      **2026-09-12: p95 7,9 ms / p99 8,7 ms / nol long task — lulus.** Jalan pertama
      (2026-09-11, p95 8,6) tidak sah: skripnya mengulang drill dengan `Tab`, padahal
      sesudah drill habis tombol ulangi adalah `Enter` di layar hasil, sehingga ~38
      frame mount-layar-hasil ikut terhitung sebagai biaya mengetik.
      Tetap manual dan memang tidak bisa dihindari: panel browser yang dikendalikan
      agent tidak pernah memanggil `requestAnimationFrame` meski `visibilityState`
      "visible" — 36 keydown tiba, nol rAF. Tanpa paint, tidak ada p95.
- [x] `watchRealInput()` — **2026-09-12: 16 entri, semuanya 16–24 ms, maks 24. Lulus**
      terhadap ambang ADR-022 (nol entri > 50 ms, p99 ≤ 32). Ambang lama ADR-020
      "nol entri = lulus" dibatalkan karena tidak bisa dipenuhi siapa pun: lantai
      `durationThreshold` 16 ms plus `duration` yang menunggu paint berikutnya membuat
      layar 60 Hz selalu menghasilkan entri, secepat apa pun kodenya.
- [x] 15 menit memakai sendiri — **dijalankan 2026-09-11.** Menemukan satu hal yang
      lolos dari 150 test: halaman bergeser saat layar hasil memunculkan scrollbar.
      Diperbaiki di hari yang sama. Sisanya memuaskan.

---

## Fase 3 — Kurikulum Unit 0–1 + `/learn` · ~3 hari  ⭐ titik uji risiko

Struktur data kurikulum, Unit 0 placement test, Unit 1 lengkap, halaman `/learn`,
logika unlock + `reconcileProgress`, kriteria kelulusan, assist ladder.

**DoD**
- [ ] Placement test menghasilkan penempatan yang masuk akal untuk 3 profil uji
- [ ] Logika unlock benar termasuk saat progres kosong, rusak, atau menunjuk lesson
      yang sudah dihapus (R-22)
- [ ] Assist ladder aktif dan terasa membantu, bukan menghina
- [ ] **Uji ke satu pemula nyata (~hari 11).** Amati tanpa memberi instruksi.
      Kalau mereka tidak paham posisi jari setelah Lesson 1, kurikulumnya yang salah —
      perbaiki sekarang, selagi baru 11 hari kerja yang dipertaruhkan, bukan 25.
- [ ] **Butir pengamatan khusus di uji itu: pergeseran mode non-strict.**
      Bukan sekadar "amati" — **hitung berapa kali ia menekan satu tombol berlebih,
      dan apakah ia menyadarinya.** Ini satu-satunya data yang bisa memutuskan kandidat
      ADR mode strict (dok. 10), dan hanya bisa diambil dari pemula sungguhan.
      Keputusannya diambil di sini; implementasinya di Fase 4.

---

## Fase 4 — Kurikulum Unit 2–6 + review session · ~3,5 hari (+0,5 bersyarat)

Sisa 25 lesson (konten sudah ditulis sebagai pekerjaan latar), review session tiap akhir unit,
validasi data kurikulum otomatis.

**Plus, kalau uji pemula Fase 3 memutuskannya: mode strict/non-strict** (~0,5 hari).
Ditaruh di sini, bukan di Fase 3, karena Fase 3 adalah fase uji risiko yang DoD-nya sudah
penuh — dan karena datanya baru ada setelah uji pemula selesai. Urutannya mengikat
(dok. 00): ubah dok. 02 §4 → naikkan kandidat di dok. 10 menjadi ADR → baru kode.

**DoD**
- [ ] Semua 30 lesson + 6 review terisi konten nyata, bukan placeholder
- [ ] Validasi kurikulum lulus: id unik, urutan tidak bolong, `reviewKeys` selalu
      sudah diperkenalkan sebelumnya
- [ ] **Kamu sendiri sudah menyelesaikan Unit 1–3 dari nol** — ini uji kualitas kurikulum
- [ ] Kriteria lulus terasa adil (tidak terlalu mudah, tidak menyiksa)

**DoD tambahan — hanya kalau mode strict jadi dikerjakan:**
- [ ] Mode bisa diganti pengguna per halaman dan tersimpan; default **strict di `/learn`,
      non-strict di `/practice`**
- [ ] **Mode yang aktif terlihat tanpa membuka pengaturan.** Pengguna yang tertahan harus
      langsung paham KENAPA ia tertahan — kalau tidak, itu terbaca sebagai aplikasi rusak
- [ ] Sorotan tombol berikutnya di virtual keyboard **bertahan** sampai ditekan benar
- [ ] `nonStrict.test.ts` diperbarui dengan sengaja, bukan dihapus — ia memang dipasang
      untuk berubah merah di titik ini

---

## Fase 5 — Latihan bebas · ~1,5 hari

Halaman `/practice`: durasi 15/30/60 detik, sumber teks, riwayat.

Turun prioritas dari Fase 3 (v1) — ini fitur yang menyenangkan, bukan fitur yang
membuktikan produk. Storage-nya sudah selesai sejak Fase 1, jadi tinggal UI.

**DoD**
- [ ] Mode timer berhenti tepat waktu
- [ ] Sumber teks dimuat lazy (chunk `wordlists`)

---

## Fase 6 — Statistik · ~3 hari

Halaman `/stats`: grafik WPM/akurasi (SVG tulis tangan), **dua** heatmap — error dan
latensi (R-18) — agregat harian, grid hari berlatih 30 hari.

**DoD**
- [ ] Grafik benar untuk 0, 1, dan 200 sesi
- [ ] Heatmap latensi menyorot tombol yang memang terasa lambat, dan **berbeda** dari
      heatmap error — kalau keduanya identik, salah satunya tidak berguna
- [ ] Nol `NaN` / grafik kosong yang jelek saat data sedikit
- [ ] Chunk `stats` tidak masuk bundel awal

---

## Fase 7 — Latihan adaptif · ~2,5 hari

Generator berbobot dari `keystats` (error × latensi), tombol "Latih kelemahanmu" di
dashboard, pemilihan kata nyata berdasarkan tombol lemah.

**DoD**
- [ ] Drill yang dihasilkan memang didominasi tombol lemah
- [ ] Hasilnya bisa diketik dengan wajar, bukan aliran huruf acak
- [ ] Tidak crash saat statistik masih sedikit (< 10 kemunculan per tombol)

---

## Fase 8 — Polish & rilis · ~3 hari

Ekspor/impor progres, suara opsional, halaman penolakan mobile, empty state, error boundary,
favicon/meta, deploy.

**DoD**
- [ ] Uji pakai ke ≥ 3 orang nyata, semuanya bisa mulai tanpa dibantu
- [ ] Lighthouse Performance ≥ 95; bundel awal < 90 KB gzip
- [ ] Uji performa Fase 1 diulang dan masih lulus
- [ ] Ekspor lalu impor menghasilkan state yang identik
- [ ] Ter-deploy dan bisa diakses lewat URL

---

## Ringkasan waktu

| Fase | Hari kerja |
|---|---|
| 0 Fondasi | 1 |
| 1 Engine + Storage | 4,5 |
| 2 Layar sesi | 3 |
| 3 Kurikulum U0–U1 + uji pengguna | 3 |
| 4 Kurikulum U2–U6 + review | 3,5 (+0,5 kalau mode strict jadi dikerjakan) |
| 5 Latihan bebas | 1,5 |
| 6 Statistik | 3 |
| 7 Adaptif | 2,5 |
| 8 Polish | 3 |
| **Total** | **~24 hari kerja** (≈5 minggu part-time) |

**MVP yang sudah berguna** tercapai di akhir Fase 4 (~hari 15).
**Umpan balik pengguna nyata pertama di ~hari 11**, bukan hari 25 — inilah perubahan
paling berharga dari revisi ini.

## Aturan menjaga scope

Setiap ide fitur baru yang muncul di tengah jalan **tidak dikerjakan langsung**.
Tulis di `10-decisions.md` bagian "Backlog ide", lanjutkan fase yang sedang berjalan.
Ini aturan yang paling sering dilanggar dan paling sering membunuh proyek pribadi.
