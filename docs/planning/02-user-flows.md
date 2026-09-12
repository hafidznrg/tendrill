# 02 — User Flows & Struktur Halaman

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

> **Catatan revisi v2.** Flow pengguna baru sekarang bercabang lewat placement test (R-14),
> layar hasil punya cabang assist ladder (R-15), dan aturan pause/void dipertegas (R-05).

## 1. Peta halaman

```
/                 → Home / dashboard ringkas (lanjutkan lesson + latihan cepat)
/learn            → Daftar kurikulum (semua unit & lesson, status terkunci/selesai)
/learn/[lessonId] → Sesi latihan terstruktur (termasuk review session)
/placement        → Placement test 60 detik (R-14), selalu bisa dilewati
/posture          → Panduan postur & anchoring, sekali tampil, selalu bisa dilewati
                    (ADR-027 — ditambahkan setelah uji pemula 2026-09-12)
/practice         → Latihan bebas (pilih durasi & sumber teks)
/stats            → Statistik & heatmap kelemahan
/settings         → Tema, suara, layout keyboard, reset/ekspor data
```

Semua halaman client-side. Tidak ada halaman yang butuh network setelah load pertama.

## 2. Flow utama — pengguna baru

```
Buka "/"
  └─ Tidak ada progres tersimpan
       └─ Hero dengan dua CTA:
            ├─ [Mulai dari nol]          → /posture (bisa dilewati) → /learn/u1-l1
            └─ [Sudah bisa mengetik?]    → /placement
                  └─ Tes 60 detik, teks campuran seluruh keyboard
                       └─ Hasil menempatkan pengguna (dok. 04 §3):
                            < 20 WPM / < 85%  → mulai Unit 1
                            20–34 WPM         → Unit 1 passed-by-placement, mulai Unit 2
                            ≥ 35 WPM & ≥ 92%  → Unit 1–3 dilewati, mulai Unit 4
                            ≥ 55 WPM & ≥ 95%  → Unit 1–5 dilewati, mulai Unit 6
                       └─ Plus diagnosis: "Unit 3 dilewati, tapi `v c x` masih sering
                          meleset — mau latih itu dulu?"
```

**Penempatan adalah saran, bukan vonis.** Pengguna selalu boleh membuka unit mana pun yang
sudah dilewati, dan selalu boleh melewatkan placement untuk mulai dari nol.

> **Kenapa panduan postur tidak boleh dilewat begitu saja (ADR-027).** Uji pemula
> 2026-09-12 menemukan tangan kanan mendarat dengan telunjuk di `h`, bukan `j` —
> seluruh tangan bergeser satu tombol, sebelum lesson pertama dimulai. Tidak ada satu
> pun titik di aplikasi yang pernah mengatakan di mana tangan diletakkan, dan warna
> jari di virtual keyboard **tidak bisa** mengatakannya: `h` dan `j` satu jari, jadi
> warnanya memang sama.

**Aturan penting:** tidak ada modal, tidak ada tur produk, tidak ada permintaan izin apa pun
sebelum keystroke pertama. Placement test sendiri adalah sesi mengetik — bukan formulir,
bukan kuesioner. Pengguna mulai mengetik dalam tiga detik di jalur mana pun.

`/posture` adalah satu-satunya layar yang berdiri di antara CTA dan keystroke pertama,
dan ia tunduk pada aturan yang sama: **satu layar, bukan tur; tombol lewati ada sejak
paint pertama**, bukan di balik gulir; dan ia hanya muncul sekali seumur perangkat.

## 3. Flow utama — pengguna kembali

```
Buka "/"
  └─ Ada progres tersimpan
       └─ Dashboard:
            • Kartu "Lanjutkan" → lesson berikutnya yang belum lulus
            • Streak hari ini (P1)
            • 3 tombol terlemah + tombol [Latih ini] (P1, adaptif)
            • Grafik mini WPM 7 hari terakhir
```

## 4. Anatomi sesi latihan (inti produk)

```
STATE: idle → running → finished
```

| State | Kondisi masuk | Yang tampil | Yang bisa dilakukan |
|---|---|---|---|
| `idle` | Halaman dimuat / setelah restart | Teks target penuh, caret di posisi 0, timer 00:00 | Mengetik (→ `running`), Tab (restart), Esc (keluar) |
| `running` | Keystroke valid pertama | Teks dengan status per karakter, WPM & akurasi live, timer berjalan | Mengetik, Backspace, Tab (restart), Esc (keluar) |
| `paused` | Window kehilangan fokus | Overlay "klik untuk lanjut", timer beku | Klik / keystroke → kembali ke `running` |
| `finished` | Teks habis / timer habis | Layar hasil | Enter (ulangi), N (lanjut), Esc (keluar) |

### Aturan interaksi
- **Timer mulai pada keystroke pertama**, bukan saat halaman dimuat.
- **Tab** = restart sesi yang sama. **Esc** = kembali ke daftar.
- **Backspace** boleh mengoreksi karakter sebelumnya (koreksi mengurangi WPM secara alami karena waktu terpakai, tapi error yang sudah tercatat tetap dihitung untuk akurasi — lihat dok. 03).
- Fokus keyboard selalu ditangkap di level dokumen; **tidak ada `<input>` yang harus
  diklik dulu**. Jika fokus hilang, tampilkan overlay "klik untuk lanjut" dan pause timer.
- **Pause tidak membatalkan sesi** (R-05). Waktu selama overlay tidak dihitung, jadi WPM
  tetap jujur meski pengguna pindah tab lima menit.
- **Diam terlalu lama dengan fokus tetap ada membatalkan sesi.** Jeda > 30 detik antar
  keystroke → sesi di-void, hasil tidak disimpan, dan layar hasil menjelaskan alasannya.
  Ini mencegah "sesi 4 jam dengan 12 WPM" mencemari statistik.
- **Mode input bisa dipilih pengguna** (ADR-029, diputuskan 2026-09-12 lewat uji pemula):

  | Mode | Karakter salah | Default di |
  |---|---|---|
  | **strict** | **menahan** — kursor tidak maju sampai tombol yang benar ditekan | `/learn` |
  | **non-strict** | tidak memblokir; ditandai, dihitung, kursor tetap maju | `/practice` |

  Di kedua mode karakter salah **tetap dicatat** sebagai kesalahan: akurasi dihitung dari
  percobaan pertama (ADR-003), dan menahan tanpa mencatat akan membuat akurasi selalu 100%.

  Aturan yang mengikat: mode yang aktif **terlihat di layar sesi tanpa membuka
  pengaturan**, bisa diganti di lesson mana pun, dan pilihannya **bertahan** ke lesson
  berikutnya. Pengguna yang tertahan harus langsung paham KENAPA ia tertahan — kalau
  tidak, itu terbaca sebagai aplikasi rusak.

  Alasan strict menjadi default di `/learn`: engine tidak punya model penyisipan, jadi di
  non-strict satu tombol **berlebih** menggeser seluruh sisa drill dan setiap karakter
  sesudahnya tercatat salah meski jarinya benar — terukur selisih 20 poin akurasi dari
  kesalahan jari yang persis sama (`src/lib/engine/__tests__/nonStrict.test.ts`).

## 5. Layar hasil

Wajib menampilkan, berurutan dari yang paling aktionable:

1. **Lulus / belum lulus** terhadap kriteria lesson (misal: butuh 25 WPM & 95%, kamu dapat 27 WPM & 92%).
2. **Satu kalimat diagnosis.** Contoh: "Kesalahan terbanyak: `e` diketik sebagai `r` (5×) — jari telunjuk kiri bergeser."
3. WPM (net) dan akurasi, dengan perbandingan terhadap percobaan terbaik sebelumnya.
   **Kecuali di `u6-review`**: lesson itu dinilai dua kali (ADR-030), sehingga angka yang
   ditampilkan hanya bagian angka/simbol sementara catatan lama berisi seluruh drill —
   dua hal yang tidak sebanding. Di sana pembandingnya disembunyikan, bukan dipaksakan.
4. Daftar 3 tombol paling bermasalah di sesi ini.
5. Tombol aksi: `Ulangi (Enter)` · `Lanjut (N)` · `Kembali (Esc)`.

### Cabang assist ladder (R-15)

Layar hasil berubah mengikuti jumlah percobaan pada lesson yang sama (dok. 04 §9):

| Percobaan | Tambahan di layar hasil |
|---|---|
| 1–2 | — |
| 3 | Diagnosis ditampilkan lebih menonjol + tombol [Drill 30 detik untuk `a` dan `;`] |
| 4–5 | Catatan bahwa target WPM diturunkan 20%; akurasi tetap |
| ≥ 6 | Tombol tambahan [Lanjut saja] → lesson ditandai `passed-with-assist` |

Nadanya tetap diagnostik, bukan menghibur secara palsu — lihat dok. 07 §11.

### Sesi yang di-void
Kalau sesi dibatalkan karena diam > 30 detik, layar hasil **tidak** menampilkan angka.
Hanya penjelasan singkat dan tombol [Ulangi] — menampilkan WPM dari sesi yang tidak sah
akan membingungkan lebih daripada membantu.

## 6. Flow latihan bebas

```
/practice
  └─ Pilih: durasi (15 / 30 / 60 detik / sampai selesai)
           sumber teks (kata umum / kalimat / kalimat bertanda baca / angka & simbol)
       └─ Sesi (state machine sama seperti di atas)
            └─ Hasil (tanpa kriteria lulus — murni skor)
                 └─ Riwayat 10 sesi latihan bebas terakhir, di bawah pilihan

Latihan bebas tidak punya kriteria kelulusan dan tidak memengaruhi unlock kurikulum,
tetapi hasilnya **tetap masuk** ke `keystats` — jadi ikut membentuk heatmap dan
latihan adaptif.
```

**Batas waktu dihitung terhadap waktu AKTIF** (ADR-032): ia mulai pada keystroke
pertama, bukan saat halaman dibuka, dan berhenti selama sesi di-pause. Teks
dibangkitkan lebih panjang daripada yang bisa diketik siapa pun dalam durasi itu,
jadi mode timer berakhir karena waktunya habis — bukan karena teksnya habis.

Sumber "kutipan" di v1 diganti "kalimat": pool kutipan tidak pernah ditulis (dok.
04 §13), sedangkan pool kalimat sudah ada dan sudah dikurasi sendiri (ADR-032).

## 7. Flow pengaturan & data

```
/settings
  ├─ Tema: sistem / terang / gelap
  ├─ Suara ketik: on / off (P1)
  ├─ Tampilkan virtual keyboard: on / off
  ├─ Tampilkan panduan jari: on / off
  ├─ Ekspor progres → unduh JSON (P1)
  ├─ Impor progres → unggah JSON (P1)
  └─ Hapus semua data → konfirmasi ketik "DELETE" → clear localStorage
```

## 8. Penanganan mobile

Deteksi viewport < 900px atau tidak adanya keyboard fisik → tampilkan halaman penjelasan:
> "Latihan 10 jari butuh keyboard fisik. Buka halaman ini di laptop atau komputer."

Halaman statistik tetap boleh dibuka di mobile (read-only).

## 9. Penanganan kegagalan

Satu `ErrorBoundary` di level rute (R-24). Kesalahan render di `/stats` tidak boleh
mematikan halaman sesi. Tombol pemulihannya berbunyi "Muat ulang tampilan" dan
**tidak menghapus data pengguna** — pengguna yang panik tidak boleh dituntun ke arah
menghapus progresnya sendiri.
