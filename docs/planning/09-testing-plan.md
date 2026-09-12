# 09 — Testing Plan

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

> **Catatan revisi v2 (R-19).** Coverage diturunkan dari "target" menjadi indikator.
> Yang menggantikannya: property-based test untuk invarian, golden fixture untuk mencegah
> regresi diam-diam, dan pengukuran latensi dengan Event Timing API alih-alih hanya
> React Profiler.

Filosofi: **tes berat di engine, tes ringan di UI.** Engine adalah logika halus dengan banyak kasus tepi — di situ tes memberi hasil terbesar. Komponen visual lebih murah diverifikasi dengan mata.

---

## 1. Piramida

| Lapisan | Cakupan | Alat |
|---|---|---|
| Unit — engine | seluruh kasus §2 + invarian §2.1 | Vitest (Node murni, tanpa DOM) |
| Property — engine & generator | invarian, ratusan kasus acak | Vitest + `fast-check` |
| Golden fixture | 1 rekaman keystroke nyata | Vitest |
| Unit — storage | seluruh kasus §3 | Vitest + mock localStorage |
| Unit — kurikulum | validasi data + unlock | Vitest |
| Komponen | Jalur kritikal saja | Testing Library |
| E2E | 3 skenario saja | Manual (v1), Playwright (opsional nanti) |

**Coverage bukan target.** Angka 90% bisa dicapai tanpa menemukan satu bug pun.
Coverage dipantau sebagai indikator ("ada modul yang belum tersentuh?"), bukan gerbang
kelulusan. Yang menjadi gerbang adalah daftar kasus di bawah plus invarian §2.1.

## 2. Kasus uji engine (wajib)

### 2.1 Invarian (property-based, `fast-check`) — gerbang wajib

Dijalankan atas ratusan aliran keystroke acak:

- [ ] `0 ≤ accuracy ≤ 100` selalu
- [ ] `netWPM ≤ grossWPM` selalu
- [ ] `0 ≤ consistency ≤ 1` selalu
- [ ] **metrik(akumulator) == metrik(pemindaian log)** pada akhir sesi — invarian
      terpenting dalam dokumen ini; inilah yang menjaga dua jalur perhitungan di
      dok. 03 §1 tidak menyimpang (R-19)
- [ ] Tidak pernah menghasilkan `NaN` atau `Infinity` untuk input apa pun
- [ ] `applyKey` tidak pernah mengalokasikan array baru (array `dirty` dipakai ulang)
- [ ] Generator hanya memakai tombol dari gabungan `newKeys` dan `reviewKeys`,
      dan panjang keluarannya tepat

### 2.2 Golden fixture

Satu rekaman aliran keystroke nyata (`fixtures/session-01.json`) beserta `SessionResult`
yang diharapkan. Setiap refactor yang menggeser angka langsung ketahuan — perlindungan
paling murah terhadap regresi diam-diam.

### Metrik
- [ ] 0 keystroke → semua metrik 0, bukan `NaN`
- [ ] 60 karakter benar dalam 60 detik → netWPM = 12
- [ ] Semua salah → akurasi 0, netWPM 0, grossWPM > 0
- [ ] Campuran benar/salah → akurasi sesuai perhitungan manual
- [ ] Backspace mengoreksi teks tetapi **tidak** menaikkan akurasi
- [ ] Konsistensi = 1 saat interval seragam; turun saat interval bervariasi

### Input
- [ ] Backspace di posisi 0 tidak melakukan apa-apa
- [ ] Mengetik setelah karakter terakhir diabaikan
- [ ] Modifier (`Shift`, `Control`, `Alt`, `Meta`) tidak tercatat sebagai keystroke
- [ ] Event dengan `isComposing: true` diabaikan
- [ ] Key repeat (tahan tombol) tercatat sebagai keystroke terpisah

### Siklus hidup sesi
- [ ] `startedAt` diisi pada keystroke pertama, bukan saat sesi dibuat
- [ ] Sesi otomatis `finished` setelah karakter terakhir benar
- [ ] Restart mengembalikan state ke `idle` bersih
- [ ] **Blur → `paused`; resume menambah `pausedMs`, sesi tetap sah** (R-05)
- [ ] **Jeda > 30 detik dengan fokus tetap ada → `voided`, hasil tidak disimpan** (R-05)
- [ ] `elapsedMs` sudah dikurangi `pausedMs` — WPM setelah pause panjang tetap masuk akal
- [ ] `finished` bersifat idempoten (memanggil dua kali tidak menggandakan hasil)
- [ ] Log yang mentok kapasitas → `overflowed = true`, metrik tetap benar (R-03)
- [ ] Target string kosong → `finished` seketika, tidak crash

### Waktu & tata letak
- [ ] Semua durasi memakai `performance.now()`; jam sistem yang melompat tidak mengubah WPM (R-04)
- [ ] `wrapText` tidak pernah memotong kata di tengah, dan `lineStarts` selalu menaik
- [ ] `wrapText` benar untuk: teks lebih pendek dari satu baris, satu kata lebih panjang
      dari `cols`, dan spasi beruntun tepat di batas baris

### Analisis error
- [ ] `errorsByKey` menghitung per karakter target, bukan karakter yang diketik
- [ ] `confusions` mencatat pasangan `(expected, actual)` dengan benar
- [ ] Karakter spasi yang salah tercatat dengan benar
- [ ] **`latencyByKey` mengakumulasi jeda ke tombol yang benar**, dan tombol pertama
      (yang tidak punya jeda sebelumnya) tidak ikut terhitung (R-18)

## 3. Kasus uji storage

- [ ] Baca key yang belum ada → mengembalikan fallback
- [ ] Baca JSON rusak → fallback, tidak throw
- [ ] Baca data versi lama → termigrasi dengan benar
- [ ] Baca data versi lebih baru → fallback, **data lama tidak ditimpa**
- [ ] `QuotaExceededError` ditangani tanpa crash
- [ ] localStorage tidak tersedia → mode memori aktif, app tetap jalan
- [ ] Rolling buffer sesi terpotong tepat di 200
- [ ] Tangga pemangkasan kuota berjalan berurutan dan berhenti di tingkat yang berhasil (R-21)
- [ ] Penulisan dijadwalkan saat idle, dan tetap ter-flush pada `visibilitychange` → hidden (R-20)
- [ ] **`reconcileProgress` mengabaikan lessonId yang sudah tidak ada tanpa menghapusnya** (R-22)
- [ ] `sessions[].lessonId` yang menggantung tidak membuat halaman statistik crash
- [ ] `daily` terpotong di 365 hari
- [ ] Ekspor → impor menghasilkan state identik (round-trip)

## 4. Kasus uji kurikulum & generator

- [ ] Generator berbobot menghasilkan panjang yang diminta
- [ ] Tidak pernah menghasilkan huruf sama 3× berturut-turut
- [ ] Hanya memakai tombol dari `newKeys ∪ reviewKeys`
- [ ] Bobot error tinggi benar-benar meningkatkan frekuensi kemunculan (uji statistik atas 10.000 sampel)
- [ ] Bobot latensi tinggi benar-benar meningkatkan frekuensi kemunculan (R-18)
- [ ] Logika unlock: lesson 1 selalu terbuka; lesson N terbuka hanya jika N-1 berstatus
      salah satu varian passed (termasuk `passed-with-assist`, `passed-by-placement`)
- [ ] Progres kosong → hanya lesson pertama + placement yang terbuka
- [ ] **Placement test membuka unit yang benar untuk tiap ambang di dok. 04 §3** (R-14)
- [ ] **Assist ladder: percobaan ke-4 menurunkan target WPM tapi tidak akurasi;
      percobaan ke-6 menawarkan `passed-with-assist`** (R-15)
- [ ] Review session hanya memakai tombol yang sudah diperkenalkan, dan jatuh ke bobot
      seragam saat `keystats` masih kosong (R-16)
- [ ] Validasi data kurikulum: semua `lessonId` unik, semua `newKeys` ada di layout,
      urutan tidak bolong, `reviewKeys` selalu sudah diperkenalkan sebelumnya

## 5. Uji performa (manual tapi wajib)

**Skrip autotype:** `scripts/perf-autotype.js` — kirim event `keydown` pada 700 CPM
(=140 WPM) selama 60 detik, pada teks 500 karakter dengan virtual keyboard menyala
(kasus terburuk).

> **Dua hal wajib dibaca sebelum memakai angkanya.**
>
> 1. **Keystroke sintetis TIDAK terekam Event Timing API** — tidak dari
>    `dispatchEvent` di konsol, dan tidak pula dari CDP (diuji 2026-09-11: keydown
>    yang sengaja diblokir 60 ms tetap menghasilkan nol entri). Konsekuensinya
>    p95 input→paint **tidak bisa diotomasi sama sekali**; lihat ADR-020.
> 2. Jalankan di **build produksi** dan dengan **tab terlihat di depan**.
>    `requestAnimationFrame` berhenti di tab tersembunyi, dan hasilnya akan tampak
>    sempurna justru karena tidak ada yang pernah dicat.

- [x] **p95 dispatch→paint ≤ 8 ms**, p99 ≤ 16 ms, diukur `scripts/perf-autotype.js`
      (`autotype()`): tiap keystroke diikuti satu `requestAnimationFrame`, jadi yang
      terukur adalah keystroke sampai frame berikutnya benar-benar dicat.
      **2026-09-12, skrip yang sudah diperbaiki: p50 6,1 · p95 7,9 · p99 8,7 ·
      maks 11,1 ms**, 644 keystroke, 19 restart, 38 frame dibuang. Lulus.
- [ ] **Event Timing API sebagai gerbang lulus/gagal** (ADR-020) — **kriterianya
      sedang ditinjau, jangan dipakai apa adanya.** Aturan "nol entri = lulus"
      berangkat dari asumsi bahwa entri hanya muncul untuk interaksi yang tersendat.
      Asumsi itu **salah**: `durationThreshold` Event Timing berlantai **16 ms** (nilai
      di bawah itu dinaikkan ke 16), dan `duration`-nya menghitung sampai paint
      BERIKUTNYA — jadi di layar 60 Hz, keystroke yang jatuh tepat sesudah satu frame
      otomatis menunggu ~16 ms dan terekam, betapa pun cepatnya kode kita.
      Terukur 2026-09-12: 16 entri, **semuanya 16 atau 24 ms** — kelipatan 8 dan tidak
      satu pun di bawah 16, persis sidik jari kedua aturan spec itu, bukan sidik jari
      aplikasi yang lambat. Perlu ADR yang mengganti ambangnya.
- [x] Chrome Performance: nol long task (> 50 ms) selama sesi — ikut diukur `autotype()`,
      yang menolak lulus kalau ada satu pun entri `longtask`. **Nol, 2026-09-12**
      (maks frame 11,1 ms, jauh di bawah 50)
- [ ] Nol "forced reflow" di panel Performance (R-06)
- [ ] Waktu ke keystroke pertama < 3 detik pada Fast 3G ter-throttle,
      diukur dengan `performance.mark` (R-24)

> **Status 2026-09-12: `autotype()` LULUS, kriteria Event Timing masih terbuka.**
>
> Setelah skripnya diperbaiki: p50 6,1 · **p95 7,9** · p99 8,7 · maks 11,1 ms, nol
> long task. Bandingkan dengan jalan yang cacat sehari sebelumnya (p95 8,6): selisihnya
> **bukan** karena kodenya membaik, melainkan karena 38 frame restart berhenti dihitung
> sebagai biaya mengetik.
>
> Catatan kecil yang jujur: 644 keystroke dalam 60,1 detik ≈ **129 WPM**, bukan 140.
> Jeda restart memakan waktu dinding. Di dalam burst-nya lajunya benar; yang turun hanya
> rata-rata lintas seluruh jalan.
>
> **Riwayat cacat di bawah ini sengaja tidak dihapus.**
>
> **Cacat pengukuran kedua di skrip yang sama (lihat juga `e3ac561`).** `autotype()`
> mengulang drill dengan menekan `Tab`. `Tab` me-restart sesi yang sedang BERJALAN,
> tetapi begitu drill habis sesi masuk `finished` dan layar hasil mengambil alih —
> di situ tombol ulangi adalah **Enter** (dok. 07 §7). Jadi skripnya berhenti maju
> dan menunggu manusia menekan Enter, sementara loop pengukurannya jalan terus.
>
> Hasilnya: p95 **8,6 ms** (anggaran 8), p99 9,8, maks 11,2, nol long task,
> `lulus: false`. Tapi angka itu tidak mengukur jalur keystroke. Pada drill 35
> karakter, 677 keystroke berarti ~19 kali drill selesai; tiap kali, satu frame
> me-*mount* layar hasil dan satu frame membangun ulang seluruh span. **~38 frame
> dari 677 = 5,6% teratas — dan p95 jatuh persis di sana.** Yang terbaca sebagian
> besar adalah biaya mengganti layar, bukan biaya mengetik.
>
> Sudah diperbaiki: skrip mengulang lewat `Enter` dan menunggu teks benar-benar
> bersih, lalu **membuang** frame penutup drill dan frame pertama sesudah restart,
> serta melaporkan berapa yang dibuang. Ia juga memperingatkan kalau teksnya jauh
> di bawah 500 karakter.
>
> **Pelajarannya sama dengan `perf:heap`:** harness pengukuran bisa menghasilkan
> angka yang tampak masuk akal dan tetap salah. Sebelum memakai angka dari harness
> baru, buktikan dulu ia mengukur yang benar.

Jalankan uji ini di akhir Fase 1 dan ulangi di akhir Fase 8.

### 5.1 Yang sudah TIDAK manual lagi (ADR-021)

Dua item pindah dari daftar di atas ke `npm run verify`, karena keduanya sama sekali
tidak butuh **paint** — dan verifikasi manual hanya benar pada hari ia dijalankan:

| Dijaga oleh | Menggantikan |
|---|---|
| `npm run perf:heap` | Chrome Memory allocation profiler |
| `src/features/typing/__tests__/rerender.test.tsx` | React Profiler DevTools |
| `src/features/typing/__tests__/sessionFlow.test.tsx` | periksa sendiri metrik live, nol penulisan storage, alur tanpa mouse |

> **Cara `perf:heap` mengukur, dan satu jebakan yang wajib diketahui.**
> Membandingkan `heapUsed` di antara dua `gc()` mengukur memori yang **ditahan**,
> bukan yang **dialokasikan** — dan alokasi per keystroke yang normal justru berumur
> pendek, jadi `gc()` terakhir menghapus persis bukti yang dicari. Versi pertama skrip
> ini melakukan itu dan **meloloskan kontrol negatif**. Yang benar: `gc()` sekali di
> awal, `heapUsed` sesudah loop tanpa gc, dan ronde yang kejatuhan GC dibuang.
>
> Aturan yang lahir dari situ: **tiap gerbang performa wajib diuji dengan kontrol
> negatif** — sisipkan alokasi/render palsu, pastikan gerbangnya merah. Gerbang yang
> belum pernah merah belum terbukti menjaga apa pun.

Hasil pertama (2026-09-11) langsung menangkap pelanggaran yang lolos dari seluruh
verifikasi Fase 1: `_dirty.length = 0` di `session.ts` membuat V8 memangkas backing
store array, dan `push` berikutnya mengalokasikan yang baru — **152 byte per
keystroke**. Identitas array-nya tidak berubah, jadi property test identitas tidak
pernah bisa melihatnya. Diganti `pop()`; sekarang 0,5 byte, sama dengan lantai
pengukuran.

## 6. Uji komponen (terbatas)

Hanya untuk yang punya logika, bukan yang murni tampilan:
- [ ] `TypingArea` menampilkan status karakter yang benar untuk state tertentu
- [ ] `ResultScreen` menampilkan lulus/gagal sesuai kriteria
- [ ] `VirtualKeyboard` menyorot tombol yang benar termasuk Shift sisi berlawanan
- [ ] Halaman mobile-block muncul di viewport sempit
- [ ] `ErrorBoundary` menangkap kesalahan render, dan tombol resetnya **tidak**
      menghapus data pengguna (R-24)

## 7. Skenario manual sebelum rilis

1. **Pengguna baru:** buka app → mulai dari nol → selesaikan Lesson 1 → lihat hasil → lanjut Lesson 2.
2. **Pengguna kembali:** refresh browser → progres masih ada → lanjutkan dari lesson yang benar.
3. **Data hilang:** hapus localStorage saat app terbuka → app tidak crash → kembali ke keadaan pengguna baru.

## 8. Uji pakai dengan orang lain

Sebelum menganggap v1 selesai, minta **3–5 orang** yang belum pernah melihat app ini:

- Jangan beri instruksi apa pun. Amati saja.
- Catat: berapa detik sampai mereka mulai mengetik? Ada yang mereka klik tapi tidak berfungsi?
- Setelah 1 sesi, tanyakan: "Apa satu hal yang perlu kamu perbaiki dalam mengetik?" Kalau mereka tidak bisa menjawab, **layar hasil gagal melakukan tugasnya.**
