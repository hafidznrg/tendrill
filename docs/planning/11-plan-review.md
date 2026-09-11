# 11 — Review & Revisi Rencana

**Tanggal:** 2026-09-10 · **Status:** Diterapkan ke dok. 03–10

Dokumen ini mencatat hasil peninjauan ulang seluruh rencana sebelum koding dimulai,
di empat sumbu: **efisiensi komputasi, kecepatan pemrosesan, kelengkapan materi, dan ketepatan fitur.**

Setiap temuan punya nomor (`R-xx`) dan sudah ditindaklanjuti di dokumen aslinya.
Baca ini kalau nanti bertanya "kenapa dok. 03 berubah?".

---

## A. Cacat yang akan menggagalkan Fase 1

### R-01 — Kontrak API engine bertentangan dengan anggaran performa · **BLOCKER**

Dok. 03 §6 mendefinisikan `applyKey(state, key, at): SessionState` — tanda tangan
fungsional murni yang **mengembalikan state baru**. Dok. 03 §5 melarang "alokasi array
baru sepanjang teks per keystroke", dan ADR-004 menyimpan state di `useRef`.

Ketiganya tidak bisa benar bersamaan. Mengembalikan `SessionState` baru berarti menyalin
`cells[]` (bisa 500 elemen) setiap keystroke — persis yang dilarang. Frasa
"atau mutasi terkontrol" di dok. 03 menyembunyikan keputusan yang belum diambil.

**Perbaikan.** Engine bermutasi eksplisit dan mengembalikan *deskripsi perubahan*, bukan state:

```ts
interface KeyOutcome {
  accepted: boolean;          // false = event diabaikan (modifier, isComposing, dst.)
  dirty: number[];            // indeks cell yang berubah — hampir selalu 1–2
  cursorMoved: boolean;
  finished: boolean;
}
applyKey(s: SessionState, key: string, atMs: number): KeyOutcome
```

Kemurnian tetap terjaga di level yang penting: engine tidak menyentuh React/DOM dan
tetap dites di Node murni. Yang dilepas hanya immutability — yang memang tidak pernah
dibutuhkan di sini karena state hanya punya satu pemilik.

### R-02 — Metrik live O(n) dijalankan 4×/detik · efisiensi komputasi

"Semua metrik diturunkan dari `keystrokes`" itu prinsip bagus untuk kebenaran,
tapi `computeLiveMetrics` yang memindai seluruh log tiap 250 ms berarti:
sesi 60 detik pada 140 WPM ≈ 700 keystroke × 4 pemindaian/detik ≈ 168.000 iterasi
plus alokasi objek hasil — **saat pengguna sedang mengetik**. Konsistensi (stdev) apalagi.

**Perbaikan.** Log tetap sumber kebenaran untuk **hasil akhir**, tapi tambahkan
**akumulator inkremental** untuk **metrik live** — semuanya O(1) per keystroke:

```ts
interface Accumulators {
  total: number;
  correct: number;
  sumInterval: number;        // untuk mean
  m2Interval: number;         // Welford → stdev tanpa menyimpan array
  countInterval: number;
  lastKeystrokeAt: number;
}
```

`computeLiveMetrics` menjadi aritmetika beberapa baris: nol alokasi, nol iterasi.
Log hanya dipindai **sekali**, di `computeResult()`, untuk `errorsByKey` dan `confusions`.

**Invarian wajib dites:** metrik dari akumulator == metrik dari pemindaian log pada akhir
sesi. Ini yang menjaga dua jalur perhitungan tidak menyimpang (lihat R-19).

### R-03 — Alokasi objek `Keystroke` per ketukan memicu GC saat mengetik · efisiensi komputasi

700 objek literal per sesi, dialokasikan tepat pada momen paling sensitif latensi.
Satu GC minor di tengah sesi = frame drop yang justru ingin dihindari.

**Perbaikan.** Log kolumnar berbasis typed array, dialokasikan **sekali** saat sesi dibuat:

```ts
const cap = target.length * 2 + 64;   // ruang untuk koreksi & overtyping
expectedCode: Uint16Array(cap)
actualCode:   Uint16Array(cap)
atMs:         Float64Array(cap)
indexAt:      Int32Array(cap)
correct:      Uint8Array(cap)
count:        number                  // penanda isi
```

Nol alokasi per keystroke. Jika `count` menyentuh `cap` (pengguna menahan tombol lama),
berhenti mencatat detail dan hanya menaikkan akumulator — metrik tetap benar,
memori berhenti tumbuh.

### R-04 — `Date.now()` dipakai untuk mengukur durasi · kebenaran

`now - startedAt` dengan `Date.now()` rentan penyesuaian jam sistem (NTP, DST, sleep).
WPM bisa melonjak atau negatif tanpa sebab yang bisa direproduksi.

**Perbaikan.** `performance.now()` (monotonik) untuk **semua** pengukuran durasi.
`Date.now()` **hanya** untuk stempel `completedAt`/`at` yang disimpan ke storage.
Keduanya tidak boleh bertemu dalam satu pengurangan.

### R-05 — Aturan "jeda > 30 detik" bertabrakan dengan "pause saat blur" · kontradiksi

Dok. 03 §7 menyatakan blur → pause timer lalu resume, **dan** jeda > 30 detik → buang sesi.
Pengguna yang pindah tab lima menit memenuhi keduanya sekaligus.

**Perbaikan.** Pisahkan dua konsep:
- **Blur** → `pausedMs` bertambah; sesi tetap sah. Elapsed = `last - start - pausedMs`.
- **Jeda saat fokus masih ada** > 30 detik → sesi **di-void** (`voided: true`, hasil tidak
  disimpan, layar hasil menjelaskan alasannya).

Tanpa pemisahan ini `elapsedMinutes` salah, dan seluruh WPM ikut salah.

### R-06 — Caret berpotensi memanggil `getBoundingClientRect` per keystroke · kecepatan

Dok. 07 meminta caret digeser dengan `transform`, tapi tidak menyebut **dari mana
koordinatnya**. Implementasi paling alami memanggil `getBoundingClientRect()` pada span
karakter setiap keystroke — **memaksa reflow sinkron**, biaya terbesar yang mungkin ada
di jalur input.

**Perbaikan.** Karena font monospace dan `line-height` tetap, koordinat itu aritmetika murni:

```
x = col * charWidth
y = row * lineHeight
```

`charWidth` diukur **sekali**, dan wajib **setelah `await document.fonts.ready`**, lalu
diukur ulang pada resize/zoom. Mengukur sebelum webfont termuat membuat caret meleset
permanen — kelas bug yang tidak disinggung sama sekali di rencana lama.

### R-07 — Pembungkusan baris diserahkan ke browser · lubang spesifikasi

Dok. 07 meminta maksimal 60 karakter per baris dan gulir per baris. Tapi jika pembungkusan
dikerjakan CSS, engine tidak tahu `row`/`col` — dan R-06 jadi mustahil.

**Perbaikan.** Tambahkan fungsi murni `wrapText(target, cols): number[]` (indeks awal tiap
baris, greedy word-wrap, tidak memotong kata), dihitung sekali per sesi. Baris ditentukan
`wrapText`, bukan CSS. Efek sampingnya bagus: gulir per baris jadi
`transform: translateY(-row * lineHeight)`, dan seluruh logikanya bisa dites tanpa DOM.

### R-08 — 500 komponen React ter-`memo` tetap mahal · kecepatan

`memo` mencegah *re-render*, bukan *reconciliation*. Setiap render induk tetap membuat 500
elemen React dan membandingkan props satu per satu. Disiplin "props primitif" juga mudah
rusak dan sulit ditegakkan lewat review diri sendiri.

**Perbaikan.** **Lapisan teks dirender React sekali, lalu diperbarui secara imperatif.**
`TypingArea` memasang span statis saat mount dan menyimpan `HTMLSpanElement[]` di ref.
Per keystroke: `spans[i].className = CLASS[state]` untuk indeks di `outcome.dirty`.
Rata-rata **1–2 penulisan DOM per keystroke, nol pekerjaan React**.

Konsekuensinya `renderTick` (dok. 06 §4) tidak lagi dibutuhkan untuk teks — hanya untuk
perubahan struktural seperti ganti target atau restart. Ini sekaligus menghapus seluruh
kelas bug memoisasi, dan mengubah DoD "≤ 3 komponen re-render per keystroke" menjadi **0**.

### R-09 — `setInterval` metrik terus berjalan dan melenceng · efisiensi komputasi

**Perbaikan.** Loop metrik hanya hidup saat `status === 'running'`; berhenti saat blur,
saat `finished`, dan saat unmount. Pakai `requestAnimationFrame` dengan gerbang waktu
250 ms — otomatis berhenti saat tab tidak terlihat, dan tidak pernah menembak di frame
yang sama dengan pemrosesan input.

---

## B. Efisiensi bundel & waktu muat

### R-10 — Recharts tidak sepadan dengan anggaran 150 KB · ketepatan fitur

Recharts beserta dependensinya ≈ 90–110 KB gzip. React + Router + Zustand ≈ 55 KB.
Anggaran 150 KB gzip di dok. 06 §6 **jebol sebelum satu baris kode aplikasi ditulis**,
demi dua grafik di halaman yang jarang dibuka.

**Perbaikan.** Hapus Recharts. Line chart dan bar chart di sini adalah `<svg>` berisi
`<polyline>` dan `<rect>` — sekitar 80 baris, sepenuhnya terkendali, dan menghapus satu
dependensi besar dari beban pemeliharaan. Tinjau ulang hanya kalau nanti butuh grafik rumit.

### R-11 — Tidak ada rencana code-splitting · kecepatan

Prinsip produk #1 adalah "keystroke pertama < 3 detik", tapi rencana lama membundel
kurikulum, wordlist, dan halaman statistik ke dalam satu bundel awal.

**Perbaikan.** Peta pemuatan eksplisit (masuk ke dok. 06):

| Chunk | Isi | Kapan dimuat |
|---|---|---|
| `main` | React, router, tema, engine, layar sesi | awal |
| `unit-1` | data lesson Unit 0–1 | awal (prefetch) |
| `unit-n` | data lesson unit lain | saat unit dibuka |
| `wordlists` | daftar kata & kutipan | saat `/practice` atau Unit 4+ |
| `stats` | halaman statistik + chart SVG | saat `/stats` |
| `settings` | halaman pengaturan | saat `/settings` |

Anggaran diubah menjadi: **bundel awal < 90 KB gzip**, total seluruh chunk < 250 KB.
Angka lama (150 KB untuk "bundel awal" tanpa definisi) tidak bisa diverifikasi.

### R-12 — Wordlist 10.000 kata dikirim mentah · efisiensi

**Perbaikan.** Daftar kata masuk repo sebagai sumber, lalu **skrip build**
(`scripts/build-wordlists.ts`) memfilternya per gugus huruf per unit menjadi file data kecil.
Unit 1 tidak perlu membawa kata yang mengandung `z`.
Ditambah `src/data/LICENSES.md` yang mencatat asal dan lisensi tiap sumber konten.

### R-13 — shadcn/ui dipasang tanpa kebutuhan konkret · ketepatan fitur

Aplikasi ini paling banyak butuh satu dialog konfirmasi dan dua select.
shadcn menarik Radix; untuk enam halaman ini biayanya lebih besar dari manfaatnya.

**Perbaikan.** Jangan pasang di awal. Kalau nanti butuh dialog yang benar secara
aksesibilitas, salin **satu** komponen shadcn saat itu juga. Ini batasan, bukan larangan.

---

## C. Kelengkapan materi (kurikulum)

### R-14 — Tidak ada jalur masuk untuk pengguna menengah · lubang produk besar

PRD menempatkan persona "Menengah tersendat (40–55 WPM)" sebagai prioritas v1,
lalu memaksa mereka melewati Unit 1 `ff jj dd kk`. Mereka akan menutup tab dalam satu menit.

**Perbaikan.** Tambahkan **Unit 0 — Placement Test** (60 detik, teks campuran seluruh keyboard):
- Menghasilkan WPM, akurasi, dan profil error per tombol.
- Membuka unit yang sesuai (mis. ≥35 WPM dan ≥92% → Unit 1–3 ditandai `passed-by-placement`,
  pengguna masuk di Unit 4), sambil tetap **menyarankan** unit yang huruf-hurufnya terbukti lemah.
- Selalu bisa dilewati; pengguna tetap boleh mulai dari nol.

Ini sekaligus langsung memenuhi kriteria sukses PRD "pengguna bisa menyebut satu kelemahan
spesifiknya setelah satu sesi" — di sesi pertama, bukan setelah berminggu-minggu.

### R-15 — Tidak ada penanganan pengguna yang mentok · penyebab dropout nomor satu

Kriteria lulus bersifat kaku (mis. 95%). Pemula yang gagal delapan kali berturut-turut di
Lesson 3 tidak punya jalan keluar selain menyerah. Rencana lama diam soal ini.

**Perbaikan.** **Tangga bantuan (assist ladder)** yang berjalan otomatis:

| Percobaan | Tindakan |
|---|---|
| 1–2 | Normal |
| 3 | Diagnosis ditampilkan lebih menonjol + tawaran drill mikro untuk tombol yang gagal |
| 4–5 | Target WPM diturunkan 20% (akurasi **tidak** diturunkan) |
| ≥6 | Tawarkan "lanjut saja" — lesson ditandai `passed-with-assist`, dicatat, dan tombolnya masuk antrean latihan adaptif |

Prinsipnya: **akurasi tidak pernah dikompromikan, kecepatan boleh menunggu.**
Ini selaras dengan prinsip kurikulum #4 yang sudah ada.

### R-16 — Tidak ada pengulangan (retensi) · kelengkapan materi

Sekali lulus, sebuah lesson tidak pernah muncul lagi. Memori otot butuh peninjauan berjarak.
Unit 4 "Words & Rhythm" mengasumsikan Unit 1–3 masih melekat, padahal bisa jadi sudah
dua minggu berlalu.

**Perbaikan.** **Review session** di tiap akhir unit dan tiap lima lesson: drill campuran
dari semua tombol yang sudah dipelajari, dibobot oleh statistik error dan latensi nyata
pengguna. Biaya implementasinya hampir nol — generator berbobot sudah ada di dok. 04 §5.

### R-17 — Peta unit tumpang tindih dan Shift diajarkan terlambat · inkonsistensi

- Unit 3 memperkenalkan `,` `.` `/` sebagai tombol baru, sementara Unit 5 berjudul
  "Capitals & Punctuation" dan mendaftar `. ,` lagi. Tombol yang sama diklaim dua kali.
- Unit 4 memakai kata umum EN dan Shift baru diajarkan di Unit 5 — artinya Unit 4 harus
  huruf kecil semua, yang tidak pernah dinyatakan. Kalimat nyata butuh huruf kapital.
- Klaim "28 lesson" tidak bisa dicocokkan dengan struktur "6 unit × 4–6 lesson"
  tanpa tabel eksplisit.

**Perbaikan.** Dinyatakan tegas di dok. 04:
- Unit 3 mengajarkan **posisi fisik** `, . /` sebagai karakter, tanpa aturan tanda baca.
- **Shift dipindah ke akhir Unit 3** sebagai lesson tersendiri (kapital + Shift sisi berlawanan),
  sehingga Unit 4 boleh memakai kalimat nyata berkapital.
- Unit 5 menjadi **"Punctuation & Sentences"** — penggunaan tanda baca dalam kalimat,
  plus simbol yang butuh Shift (`? ! : " '`).
- Ditambahkan tabel lesson eksplisit: **Unit 0 + 30 lesson**, bernomor, tanpa lubang.

### R-18 — Diagnosis hanya berbasis error, padahal masalah menengah adalah latensi · ketepatan fitur

Pengguna 50 WPM biasanya **tidak banyak salah** — mereka lambat di tombol tertentu
(kelingking, `p`, `q`, baris angka) dan di transisi tertentu. `keystats` lama hanya menyimpan
`{attempts, errors}`, jadi produk buta terhadap masalah utama persona prioritas kedua.

**Perbaikan.** Tambahkan akumulator latensi — biayanya satu penjumlahan per keystroke:

```ts
keys: { "p": { attempts, errors, totalMs, slowCount } }
```

- **Latensi rata-rata per tombol** → heatmap kedua di `/stats`: "lambat" ≠ "salah".
- Generator adaptif membobot error **dan** latensi:
  `weight = base × errorMultiplier × latencyMultiplier`
- (P1) **Bigram teratas**: 50 pasangan transisi paling lambat — inilah yang benar-benar
  membuka plateau 50→70 WPM. Murah: satu Map kecil, dipangkas saat disimpan.

Ini penambahan dengan nilai tertinggi per baris kode dalam seluruh peninjauan ini.

---

## D. Storage, testing, dan urutan kerja

### R-19 — Coverage dijadikan target, bukan invarian · kualitas tes

"Coverage ≥ 90%" bisa dicapai tanpa menemukan satu bug pun.

**Perbaikan** (masuk dok. 09):
- **Property-based test** (`fast-check`) untuk invarian yang harus selalu benar:
  `0 ≤ accuracy ≤ 100`, `netWPM ≤ grossWPM`, `metrik(akumulator) == metrik(log)`,
  generator hanya memakai tombol yang diizinkan, panjang keluaran tepat.
- **Golden fixture**: satu rekaman aliran keystroke nyata (JSON) beserta hasil yang
  diharapkan. Refactor apa pun yang menggeser angka langsung ketahuan.
- Latensi input diukur dengan **Event Timing API** (`PerformanceObserver`, `type: 'event'`),
  bukan hanya React Profiler — itu mengukur input→paint yang sesungguhnya.
- Target latensi dipertajam: **p95 ≤ 8 ms** (banyak layar sekarang 120 Hz), p99 ≤ 16 ms.

### R-20 — Penulisan storage 150 KB di akhir tiap sesi · efisiensi

`typing:sessions` ditulis utuh (`JSON.stringify` ~150 KB) setiap sesi selesai — tepat saat
layar hasil sedang masuk.

**Perbaikan.**
- Batas rolling turun **500 → 200 sesi** (agregat `daily` sudah menopang grafik jangka panjang).
- Penulisan dijadwalkan lewat `requestIdleCallback` (fallback `setTimeout(0)`), **setelah**
  layar hasil ter-paint.
- Flush paksa pada `visibilitychange → hidden` supaya tidak ada data yang hilang.

### R-21 — `QuotaExceededError` "ditangani" tanpa strategi · ketahanan

**Perbaikan.** Tangga pemangkasan eksplisit, dicoba berurutan:
1. Pangkas `sessions` menjadi 100 → tulis ulang.
2. Pangkas `daily` menjadi 180 hari → tulis ulang.
3. Buang `confusions` dan bigram → tulis ulang.
4. Masih gagal → mode memori + banner "penyimpanan penuh, ekspor progresmu".

### R-22 — Data lama menunjuk lesson yang sudah tidak ada · ketahanan

Kurikulum pasti berubah. `progress.lessons["u2-l4"]` dan `sessions[].lessonId` bisa menunjuk
id yang sudah dihapus. Rencana lama hanya membahas migrasi versi skema, bukan **drift konten**.

**Perbaikan.** Semua pembacaan yang menggabungkan progres dengan kurikulum wajib melewati
`reconcileProgress(progress, curriculum)`: id tak dikenal tetap disimpan (jangan dihapus —
bisa jadi kembali) tapi **diabaikan** saat menghitung unlock dan statistik.
Ditambahkan sebagai kasus uji.

### R-23 — Urutan fase menunda umpan balik pada bagian paling berisiko · efisiensi kerja

Tiga masalah di dok. 08:
1. **Storage baru ada di Fase 3**, padahal Fase 2 (layar hasil) dan Fase 4 (progres)
   membutuhkannya. Sepanjang Fase 2 hasil sesi tidak bisa disimpan, jadi tidak bisa diuji
   dalam pemakaian nyata.
2. **Uji ke orang lain baru di Fase 7 (~hari 25).** Risiko terbesar proyek ini bukan kode,
   melainkan apakah kurikulumnya benar-benar mengajar. Mengetahuinya di hari 25 berarti
   tiga minggu kerja dipertaruhkan pada asumsi yang belum diuji sama sekali.
3. Penulisan konten (3 hari, non-koding) diserialkan di Fase 4, padahal **nol ketergantungan**
   pada kode — pekerjaan yang bisa dicicil sejak hari pertama.

**Perbaikan** (rincian di dok. 08 revisi):
- Storage layer digabung ke ekor Fase 1 (~0,5 hari, membuka semua fase berikutnya).
- **Fase 3 = Kurikulum Unit 0–1 + halaman `/learn`**, ditutup dengan
  **uji ke satu pemula nyata (~hari 11)**. Kalau kurikulumnya salah, yang hilang 11 hari,
  bukan 25.
- Penulisan konten Unit 2–6 dicicil sebagai pekerjaan latar di sela fase koding.
- Latihan bebas turun prioritas ke setelah kurikulum — ia fitur yang menyenangkan,
  bukan fitur yang membuktikan produk.

### R-24 — Hal kecil yang tetap perlu dicatat

- **Batas "< 3 detik" tidak punya cara ukur.** Ditetapkan: waktu dari navigasi sampai
  `TypingArea` interaktif, diukur dengan `performance.mark`, pada jaringan Fast 3G ter-throttle.
- **Key repeat** dihitung sebagai keystroke sah (sudah benar), tapi perlu ditulis eksplisit:
  `event.repeat === true` tetap diproses — jangan sampai "dirapikan" jadi diabaikan nanti.
- **Streak** berpotensi menghukum. Diubah menjadi grid "hari berlatih dalam 30 hari terakhir",
  dengan streak sebagai angka sekunder, tanpa animasi patah atau menyala.
- **Blokir paste** harus mencakup `Shift+Insert` dan drag-drop teks, bukan hanya `Ctrl/Cmd+V`.
- **Error boundary** belum disebut sama sekali: satu boundary di level rute, dengan tombol
  "reset tampilan" yang **tidak** menghapus data pengguna.

---

## Ringkasan dampak

| Sumbu | Perubahan terpenting |
|---|---|
| Efisiensi komputasi | R-02 akumulator O(1) · R-03 log typed-array nol alokasi · R-09 loop metrik terjaga |
| Kecepatan pemrosesan | R-08 lapisan teks imperatif (0 kerja React/keystroke) · R-06 caret aritmetika (0 reflow) · R-11 code-splitting |
| Kelengkapan materi | R-14 placement test · R-15 assist ladder · R-16 review berjarak · R-17 peta unit diperbaiki + tabel 30 lesson |
| Ketepatan fitur | R-18 latensi per tombol & bigram · R-10 buang Recharts · R-13 tunda shadcn · R-23 urutan fase & uji pengguna dini |

**Perkiraan waktu:** ~25 hari → **~24 hari**. Penambahan (Unit 0, assist ladder, latensi,
review session) kira-kira diimbangi penghapusan (Recharts, shadcn, memoisasi per-karakter,
practice yang disederhanakan). Yang benar-benar berubah bukan totalnya, melainkan
**kapan risiko terbesar terungkap** — dari hari 25 menjadi hari 11.
