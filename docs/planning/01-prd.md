# 01 — Product Requirements Document

**Produk:** Typing Trainer web app untuk belajar mengetik 10 jari
**Versi:** v1 (draft) · **Tanggal:** 2026-09-10
**Status:** Planning

---

## 1. Masalah

Orang yang ingin bisa mengetik 10 jari biasanya gagal karena tiga hal:

1. **Tidak tahu urutan belajarnya.** Langsung latihan kalimat acak, jarinya tidak pernah terbentuk polanya.
2. **Latihannya tidak menyasar kelemahan.** Terus mengulang huruf yang sudah dikuasai, huruf yang lemah tetap lemah.
3. **Tidak ada umpan balik yang bermakna.** Cuma tahu "WPM saya 35", tanpa tahu apa yang harus diperbaiki.

## 2. Tujuan produk

Membawa pengguna dari **mengetik 2 jari sambil melihat keyboard** menjadi **mengetik 10 jari tanpa melihat keyboard di ≥40 WPM dengan akurasi ≥95%**, lewat jalur latihan yang berurutan dan adaptif.

### Non-tujuan (v1)
- Bukan aplikasi kompetisi/leaderboard.
- Bukan aplikasi sosial (tidak ada akun, teman, multiplayer).
- Bukan untuk perangkat mobile.
- Tidak mengajarkan layout selain QWERTY.

## 3. Target pengguna

| Persona | Kondisi awal | Kebutuhan utama |
|---|---|---|
| **Pemula total** | Mengetik 2–4 jari, ~20 WPM, selalu melihat keyboard | Struktur belajar dari nol, panduan posisi jari |
| **Menengah tersendat** | 40–55 WPM, sudah 10 jari tapi banyak typo | Diagnosis kelemahan + drill spesifik |
| **Ingin maintain** | >70 WPM | Mode latihan bebas, statistik, konsistensi harian |

Prioritas v1: **Pemula total** dan **Menengah tersendat**.

## 4. Prinsip produk

1. **Sesi dimulai dalam < 3 detik.** Buka app → langsung bisa mengetik. Tidak ada onboarding wajib, tidak ada login.
2. **Umpan balik harus aktionable.** Tidak cukup "akurasi 91%" — harus "huruf `t` dan `y` sering tertukar, ini drill-nya".
3. **Jangan menghukum kesalahan secara emosional.** Tanpa suara error yang keras, tanpa merah menyala. Error ditandai, bukan diteriaki.
4. **Konsistensi > intensitas.** Dorong sesi 10 menit tiap hari, bukan 2 jam sekali seminggu.
5. **Data milik pengguna.** Semuanya lokal, bisa diekspor dan dihapus kapan saja.

## 5. Ruang lingkup fitur

### P0 — Wajib ada untuk rilis pertama

| Fitur | Deskripsi |
|---|---|
| **Typing engine** | Render teks target, tangkap keystroke, tandai benar/salah per karakter, caret bergerak |
| **Metrik realtime** | WPM (gross & net), akurasi, waktu berjalan |
| **Ringkasan sesi** | Hasil akhir: WPM, akurasi, jumlah error, daftar tombol bermasalah |
| **Virtual keyboard** | Keyboard on-screen, highlight tombol berikutnya, warna per jari |
| **Kurikulum berjenjang** | Lesson terstruktur home row → seluruh keyboard, dengan syarat kelulusan |
| **Placement test** | Tes 60 detik di awal; menempatkan pengguna menengah di unit yang tepat, bisa dilewati (R-14) |
| **Assist ladder** | Bantuan otomatis saat pengguna gagal berulang kali di satu lesson; akurasi tidak pernah dikompromikan (R-15) |
| **Review session** | Peninjauan berjarak di tiap akhir unit, dibobot statistik nyata pengguna (R-16) |
| **Progres lokal** | Lesson yang selesai, skor terbaik, tersimpan di localStorage |
| **Mode latihan bebas** | Latihan kata/kalimat acak dengan durasi pilihan (15/30/60 detik) |
| **Statistik** | Grafik WPM & akurasi dari waktu ke waktu, **dua** heatmap: kesalahan dan kelambatan per tombol (R-18) |
| **Restart cepat** | Tab / Esc untuk mengulang tanpa menyentuh mouse |

### P1 — Setelah P0 stabil

| Fitur | Deskripsi |
|---|---|
| **Latihan adaptif** | Generator drill berbobot dari tombol yang paling sering salah |
| **Streak harian** | Hitungan hari berturut-turut berlatih |
| **Tema terang/gelap** | Termasuk mode fokus (menyembunyikan elemen non-esensial) |
| **Ekspor/impor progres** | Unduh JSON, muat ulang di browser lain |
| **Sound feedback** | Klik ketikan opsional, bisa dimatikan |

### P2 — Setelah produk terbukti dipakai

- Konten bahasa Indonesia
- Layout selain QWERTY (Dvorak, Colemak)
- Mode angka & simbol lanjutan (programmer mode)
- Sertifikat / ringkasan pencapaian yang bisa dibagikan

### Out of scope (eksplisit)
Auth, backend, leaderboard, multiplayer, mobile app, monetisasi.

## 6. Kriteria sukses

Karena tidak ada backend/analytics, ukuran ini diverifikasi lewat **uji pakai manual** ke 5–10 orang, bukan dashboard.

| Metrik | Target |
|---|---|
| Waktu dari buka app sampai keystroke pertama | < 3 detik, diukur `performance.mark` pada Fast 3G ter-throttle (R-24) |
| Input latency (keystroke → karakter terupdate) | p95 < 8 ms, p99 < 16 ms — diukur Event Timing API (R-19) |
| Pengguna pemula menyelesaikan Lesson 1 tanpa bertanya | 5 dari 5 penguji |
| Frame drop saat mengetik 100+ WPM | 0 |
| Pengguna bisa menyebut 1 kelemahan spesifiknya setelah 1 sesi | ≥ 4 dari 5 penguji |

## 7. Batasan & asumsi

- Browser modern saja (Chrome/Edge/Firefox/Safari terbaru). Tidak ada dukungan IE/legacy.
- Pengguna memakai keyboard fisik dengan layout QWERTY US.
- Kuota localStorage ~5 MB; skema data harus tetap jauh di bawah itu (target < 500 KB setelah setahun pemakaian).
- Data hilang jika pengguna membersihkan browser data — ini diterima, dan dikomunikasikan lewat fitur ekspor.
- Aplikasi berjalan sepenuhnya di klien; bisa di-host sebagai static site.

## 8. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Performa render buruk saat mengetik cepat | Fatal — produk terasa rusak | State di ref, render per-karakter termemoisasi, benchmark sejak Fase 1 |
| Kurikulum tidak disusun serius | Produk jadi "sekadar tes ketik" | Kurikulum diperlakukan sebagai deliverable tersendiri (dok. 04) |
| **Kurikulum ternyata tidak mengajar** | Fatal — 3 minggu kerja terbuang | **Uji ke pemula nyata di ~hari 11**, bukan hari 25 (ADR-012) |
| **Pengguna menengah pergi di menit pertama** | Kehilangan separuh persona prioritas | Placement test (ADR-010) |
| **Pemula mentok lalu menyerah** | Penyebab dropout nomor satu | Assist ladder (ADR-010) |
| localStorage terhapus, progres pengguna lenyap | Kepercayaan hilang | Ekspor JSON (P1), peringatan jelas di UI |
| Scope melar ke leaderboard/auth | Proyek tidak selesai | Out-of-scope ditulis eksplisit di atas; perubahan wajib lewat ADR |
| Konten drill EN tidak natural | Latihan terasa membosankan | Pakai daftar kata frekuensi tinggi + kutipan domain publik |
