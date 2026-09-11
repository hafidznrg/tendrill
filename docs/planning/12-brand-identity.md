# 12 — Brand & Identitas Visual

**Nama produk:** **tendrill**
**Versi:** v1 (draf 1) · **Tanggal:** 2026-09-11 · **Status:** Diterima

Dokumen ini menetapkan nama, logo, wordmark, tipografi, dan palet warna.
Token warna di sini adalah sumber kebenaran untuk `--bg`, `--fg`, `--accent`, dst. yang
dipakai [07-ux-ui-spec.md](07-ux-ui-spec.md) §5. Kalau keduanya berbeda, dokumen ini menang.

---

## 1. Nama

**tendrill** — selalu ditulis huruf kecil.

Namanya menyimpan tiga makna sekaligus, dan ketiganya memang isi produk:

| Bacaan | Arti | Dibawa ke mana |
|---|---|---|
| **ten** | sepuluh jari — janji utama produk | Mark alternatif B (sepuluh batang) |
| **tendril** | sulur; tumbuh merambat bertahap | Mark utama (sulur) |
| **drill** | latihan terarah pada kelemahan | Nada UI: terstruktur, bukan kasual |

Ejaan dengan dua `l` disengaja: membedakan dari kata `tendril` yang umum, dan memberi
huruf ganda yang berguna untuk penanda home row (lihat §3).

**Risiko yang diterima.** Sebagian orang akan membacanya "tendon" atau "tendril" dan
kehilangan bacaan *ten*. Dimitigasi oleh tagline dan lockup vertikal yang membawa teks
`SEPULUH JARI`.

**Domain.** Tidak membeli domain sendiri — akan memakai **subdomain dari situs pribadi**.
Konsekuensinya: nama tidak perlu tersedia sebagai domain apex, dan tidak ada tenggat
pembelian yang mendesak keputusan ini.

---

## 2. Simbol

Empat arah dieksplorasi; **A dipilih**.

| # | Konsep | Status | Catatan |
|---|---|---|---|
| **A** | **Sulur & caret** — sulur merambat naik dari garis home row, caret berdiri di sebelahnya | **Utama** | Satu-satunya yang membawa ketiga makna nama dan tetap terbaca pada 16 px |
| B | Sepuluh batang berwarna jari | Sekunder | Dipakai di halaman `/stats`; bahasanya sama dengan virtual keyboard. Lemah saat monokrom |
| C | Keycap tumbuh | Ditolak | Paling mudah tertukar dengan app keyboard lain |
| D | Monogram `t` dengan palang jadi sulur | Cadangan | Hemat ruang untuk avatar; butuh wordmark di sampingnya |

Berkas: `src/assets/brand/mark.svg` (A), `mark-stats.svg` (B), `monogram.svg` (D).

**Anatomi mark A.**
- Garis home row: horizontal, opasitas 35%, memakai `currentColor` — ikut warna teks.
- Sulur: `--accent`, `stroke-width` 4 pada viewBox 64, ujung membulat.
- Caret: `--caret`, persegi panjang tegak di kanan sulur. **Wajib ada** — inilah yang
  membedakan logo ini dari logo tanaman.

---

## 3. Wordmark

```
ten d ri l l
    ─     ─
```

Dari delapan huruf di *tendrill*, hanya **d** dan **l** yang duduk di home row
(`a s d f · j k l ;`). Keduanya diberi **garis bawah setebal 0.11em warna `--accent`**.

Ini bukan hiasan: kurikulum produk tertanam di namanya sendiri. Huruf ganda `ll` membuat
aturannya terbaca — satu bergaris, satu tidak, jadi mata menangkap bahwa penandanya
punya logika.

**Spesifikasi.**
- Font: JetBrains Mono **ExtraBold (800)**
- Tracking: **−0.045em**
- Selalu huruf kecil. Kapital merusak ritme monospace dan membuat garis bawah
  kehilangan tumpuan.
- Ruang kosong minimal: **setinggi caret** di keempat sisi lockup.

**Lockup.**

| Varian | Susunan | Dipakai di |
|---|---|---|
| Horizontal | mark 34 px + wordmark 26 px | Bilah atas, header halaman |
| Vertikal | mark 40 px di atas wordmark 22 px + `SEPULUH JARI` | Splash, halaman about, og:image |
| Di atas aksen | mark & wordmark `#F4F8F2` penuh, caret tetap `--caret` | Kartu, tombol besar |
| Dalam sesi | mark **20 px**, tidak pernah lebih besar | `/session` — lihat §7 |

---

## 4. Tipografi

| Peran | Typeface | Spesifikasi |
|---|---|---|
| Wordmark | JetBrains Mono 800 | −0.045em, lowercase |
| Teks latihan | JetBrains Mono 400 | 24–28px, `line-height` 1.8 (lihat 07 §6) |
| Judul | JetBrains Mono 700 | 19px, −0.02em |
| Badan teks | IBM Plex Sans 400 | 15px, maks. ~65 karakter per baris |
| Angka & metrik | JetBrains Mono 700 | `font-variant-numeric: tabular-nums` |
| Label | JetBrains Mono 500 | 11px, `letter-spacing` .16em, uppercase |

**Kenapa ini.** Wordmark memakai font yang sama dengan teks latihan, jadi logonya benar-benar
terbuat dari bahan produknya sendiri. IBM Plex Sans dipilih karena sekeluarga rasa dengan
IBM Plex Mono yang sudah jadi opsi cadangan di 07 §6, dan cukup netral untuk dibaca lama.

> **Ingat R-06.** `charWidth` diukur **setelah** `await document.fonts.ready`. Menambah
> webfont di sini tidak mengubah aturan itu — justru mempertegasnya.

---

## 5. Warna

Netralnya **bukan abu-abu murni**: semuanya dimiringkan sedikit ke hijau supaya sebidang
dengan aksen.

| Token | Terang | Gelap | Fungsi |
|---|---|---|---|
| `--bg` | `#EFF2EE` | `#11150F` | Latar halaman |
| `--surface` | `#E3E8E1` | `#1A2018` | Kartu, virtual keyboard |
| `--surface-2` | `#F7F9F6` | `#222A20` | Panel di atas surface |
| `--fg` | `#161A17` | `#E7ECE3` | Karakter benar, teks utama |
| `--fg-dim` | `#6E776E` | `#8E988B` | Karakter belum diketik |
| `--line` | `#C9D1C7` | `#2E3829` | Garis pemisah, border |
| `--accent` | `#2F6B4A` | `#77B98D` | Sulur, progress bar, tombol utama |
| `--caret` | `#B0791F` | `#D7A94E` | **Caret saja** |
| `--error` | `#A8432F` | `#D2705A` | Karakter salah |

**Dua aturan keras.**

1. **`--caret` eksklusif untuk penanda posisi.** Ia satu-satunya warna panas di seluruh
   antarmuka. Begitu dipakai untuk tombol, badge, atau streak, ia berhenti berarti
   "kamu di sini".
2. **`--error` tidak pernah sendirian.** Selalu berpasangan dengan garis bawah — buta warna,
   dan prinsip PRD #3 ("ditandai, bukan diteriaki"). Saturasinya sengaja rendah.

### Palet jari (virtual keyboard)

Delapan warna, semuanya disaturasi rendah agar keyboard tidak berteriak lebih keras
dari teks latihan.

| Token | Jari | Terang | Gelap |
|---|---|---|---|
| `--f1` | Kelingking kiri | `#4C6E8A` | `#8BB0CE` |
| `--f2` | Manis kiri | `#5B7F5E` | `#9CC39F` |
| `--f3` | Tengah kiri | `#8A7340` | `#CBB27A` |
| `--f4` | Telunjuk kiri | `#8C5A6E` | `#CE97AA` |
| `--f5` | Telunjuk kanan | `#7A5F94` | `#B8A0D2` |
| `--f6` | Tengah kanan | `#3F7C7A` | `#7FC0BE` |
| `--f7` | Manis kanan | `#96612F` | `#D6A473` |
| `--f8` | Kelingking kanan | `#55617F` | `#9AA6C6` |

Jempol memakai `--fg-dim`. Kontras minimum 4.5:1 tetap berlaku untuk semua teks (07 §5).

---

## 6. Favicon & ikon aplikasi

Pada 16 px, garis home row dan caret terpisah menjadi bubur. Versi kecil **membuang
garis dasar** dan menebalkan sulur; caret dipertahankan.

| Ukuran | Isi | `stroke-width` sulur (viewBox 64) |
|---|---|---|
| 512 / 256 | Sulur + caret, latar `--accent`, radius 22% | 5.5 |
| 64 | Sulur + caret | 6.5 |
| 32 | Sulur dipendekkan (ekor kurva dibuang) | 8 |
| 16 | Sulur seminimal mungkin + caret melebar | 10 |

Berkas: `src/assets/brand/icon-512.svg`, `icon-32.svg`, `icon-16.svg`.

---

## 7. Aturan pakai

**Lakukan**
- Wordmark selalu huruf kecil semua.
- Ruang kosong minimal setinggi caret di keempat sisi lockup.
- Di latar gelap, pakai sulur terang penuh (`#F4F8F2`) — bukan `--accent` yang
  diturunkan opasitasnya.
- Di layar sesi, mark maksimal **20 px** di bilah atas.

**Hindari**
- Gradien atau bayangan pada sulur. Mark ini satu warna datar agar bisa dicetak dan
  tetap hidup pada 16 px.
- `--caret` untuk apa pun selain caret.
- **Menganimasikan sulur "tumbuh" saat sesi berjalan.** Gerakan di tepi layar menarik
  mata keluar dari baris teks — pelanggaran langsung terhadap prinsip UX #1 (07 §1).
- Membesarkan wordmark di halaman sesi. Identitas hadir, tidak merebut perhatian.

---

## 8. Yang belum diputuskan

- [ ] og:image dan meta sosial (butuh lockup vertikal di kanvas 1200×630)
- [x] ~~Subdomain persisnya di situs pribadi~~ → **`tendrill.hafidznrg.my.id`**,
      di-deploy ke Vercel (2026-09-11). Menutup pertanyaan terbuka ADR-015.
- [ ] Apakah mark B benar dipakai di `/stats`, atau cukup mark A saja
