# 07 — UX / UI Specification

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

> **Catatan revisi v2.** Ditambahkan aturan tata letak baris yang deterministik (R-07),
> pengukuran font sebelum caret dipasang (R-06), heatmap latensi (R-18), dan streak yang
> tidak menghukum (R-24).

## 1. Prinsip desain

1. **Layar sesi adalah produknya.** Semua halaman lain hanya pengantar ke sana. Saat sesi berjalan, tidak ada elemen yang bergerak selain caret dan angka metrik.
2. **Tidak ada layout shift.** Angka metrik memakai font tabular; teks target punya tinggi tetap. Karakter salah tidak boleh mengubah lebar.
3. **Keyboard-first.** Semua aksi utama bisa dilakukan tanpa mouse.
4. **Kontras rendah untuk yang belum diketik, kontras tinggi untuk posisi saat ini.** Mata harus tertarik ke caret secara otomatis.

## 2. Layout layar sesi

```
┌──────────────────────────────────────────────────────┐
│  ← Unit 2 · Lesson 3            00:24   38 WPM  96%  │  ← baris status, tenang
├──────────────────────────────────────────────────────┤
│                                                      │
│      the quick brown fox jumps over the lazy         │  ← teks target
│      dog and runs back again to the warm den         │     max ~60ch per baris
│                                                      │
├──────────────────────────────────────────────────────┤
│              [ virtual keyboard ]                    │  ← bisa disembunyikan
│                                                      │
├──────────────────────────────────────────────────────┤
│   Tab restart · Esc keluar                           │  ← petunjuk, sangat redup
└──────────────────────────────────────────────────────┘
```

Aturan:
- Teks target maksimal **3 baris terlihat**; saat baris pertama selesai, teks bergulir naik
  satu baris (bukan per karakter).
- Lebar baris **50–60 karakter**. Lebih panjang membuat mata kesulitan kembali ke awal baris.
- Metrik live diletakkan **jauh dari teks** supaya tidak mencuri perhatian saat mengetik.

### Pembungkusan baris bersifat deterministik, bukan CSS (R-07)

Baris ditentukan oleh `wrapText(target, cols)` di engine (dok. 03 §8), **bukan** oleh
pembungkusan otomatis browser. Alasannya bukan estetika melainkan mekanis: kalau CSS yang
membungkus, aplikasi tidak tahu `row`/`col`, dan posisi caret hanya bisa didapat lewat
`getBoundingClientRect()` — yang memaksa reflow sinkron di jalur input, biaya paling mahal
yang mungkin ada di sana.

Konsekuensinya:
- Kontainer teks memakai `white-space: pre` dan menyisipkan pemisah baris sendiri.
- Gulir per baris = `transform: translateY(-row * lineHeight)`.
- Posisi caret = `translate(col * charWidth, row * lineHeight)`, aritmetika murni.

## 3. Status karakter

| Status | Perlakuan visual |
|---|---|
| `pending` | Warna teks samar (≈40% opacity) |
| `correct` | Warna teks penuh, tenang (bukan hijau menyala) |
| `incorrect` | Warna error + garis bawah; jika karakternya spasi, tampilkan blok berwarna |
| `corrected` | Warna teks penuh + penanda halus (titik kecil di bawah) |
| posisi caret | Batang vertikal berkedip, transisi `transform` 80ms |

**Jangan** memakai background merah blok untuk error — terlalu agresif dan merusak ritme baca.

## 4. Virtual keyboard & panduan jari

- Menampilkan layout QWERTY penuh.
- **Tombol berikutnya** disorot dengan outline.
- Setiap tombol diberi warna sesuai jari yang bertanggung jawab (8 warna + jempol).
- Virtual keyboard **tidak boleh** memaksa reflow: sorotan tombol berikutnya diperbarui
  dengan mengganti `className` pada satu elemen tombol, bukan dengan me-render ulang
  seluruh keyboard.
- Saat karakter butuh Shift, kedua tombol disorot: huruf dan Shift **di sisi berlawanan** (mengajarkan kebiasaan Shift yang benar sejak awal).
- Bisa dimatikan di settings — pengguna tingkat lanjut akan mematikannya, dan pemula harus didorong mematikannya setelah Unit 3.

### Pemetaan jari (QWERTY)
```
Kelingking kiri : ` 1 q a z  Tab CapsLock Shift
Manis kiri      : 2 w s x
Tengah kiri     : 3 e d c
Telunjuk kiri   : 4 5 r t f g v b
Jempol          : Space
Telunjuk kanan  : 6 7 y u h j n m
Tengah kanan    : 8 i k ,
Manis kanan     : 9 o l .
Kelingking kanan: 0 - = p [ ] \ ; ' / Enter Backspace Shift
```

## 5. Tema & warna

Definisikan sebagai CSS variable, terang sebagai default, gelap sebagai override.

> **Nilai token ada di [12-brand-identity.md](12-brand-identity.md) §5**, dan dikodekan
> di `src/assets/brand/tokens.css`. Tabel di bawah hanya menetapkan *fungsi*. Kalau
> keduanya berbeda, dok. 12 menang.

| Token | Fungsi |
|---|---|
| `--bg` | Latar halaman |
| `--fg-dim` | Karakter belum diketik |
| `--fg` | Karakter benar / teks utama |
| `--error` | Karakter salah |
| `--accent` | Progress bar, tombol utama, sulur logo |
| `--caret` | **Caret saja** — satu-satunya warna panas di antarmuka (ADR-016) |
| `--surface` | Kartu, virtual keyboard |
| `--line` | Garis pemisah, border |
| `--f1`…`--f8` | Palet jari untuk virtual keyboard |

Kontras minimum 4.5:1 untuk semua teks. Warna error tidak boleh menjadi satu-satunya penanda — selalu disertai garis bawah (buta warna).

## 6. Tipografi

> **Pasangan font sudah ditetapkan** di [12-brand-identity.md](12-brand-identity.md) §4:
> JetBrains Mono (teks latihan, judul, angka, wordmark) + IBM Plex Sans (badan teks).

- Teks latihan: **font monospace** (JetBrains Mono). Lebar karakter tetap
  berarti tidak ada layout shift, dan posisi caret bisa dihitung tanpa menyentuh DOM.

### Pengukuran `charWidth` (R-06) — wajib, mudah terlewat

`charWidth` diukur **sekali** dari elemen contoh, dan **wajib setelah
`await document.fonts.ready`**. Mengukur sebelum webfont termuat akan mengunci caret pada
lebar font fallback — caret meleset permanen, dan gejalanya (caret makin jauh melenceng ke
kanan sepanjang baris) mudah disalahartikan sebagai bug engine.

Ukur ulang pada `resize` dan perubahan zoom (`visualViewport`). Sampai pengukuran selesai,
tampilkan teks tanpa caret alih-alih caret di posisi yang salah.
- Ukuran teks latihan: 24–28px. Ini besar — memang disengaja, mengurangi kelelahan mata.
- `line-height` 1.8 untuk teks latihan.
- UI selain teks latihan: **IBM Plex Sans**, dengan sans-serif sistem sebagai fallback.
  Judul, angka metrik, dan label tetap monospace (dok. 12 §4).

## 7. Pintasan keyboard global

| Tombol | Aksi |
|---|---|
| `Tab` | Restart sesi |
| `Esc` | Keluar sesi / tutup dialog |
| `Enter` | (di layar hasil) Ulangi |
| `N` | (di layar hasil) Lesson berikutnya |
| `Ctrl/Cmd + K` | Command palette (P2) |

## 8. Aksesibilitas

- Layar hasil diumumkan lewat `aria-live="polite"`.
- Metrik live **tidak** di-`aria-live` (terlalu berisik untuk screen reader).
- Semua kontrol punya label; virtual keyboard `aria-hidden` (dekoratif).
- Hormati `prefers-reduced-motion`: matikan kedip caret dan transisi.
- Fokus terlihat jelas di semua elemen interaktif.

## 9. Statistik: dua heatmap, bukan satu (R-18)

`/stats` menampilkan **dua** heatmap berdampingan dengan skala warna berbeda:

| Heatmap | Sumber | Menjawab |
|---|---|---|
| **Kesalahan** | `errors / attempts` per tombol | "Tombol mana yang sering meleset?" |
| **Kelambatan** | `totalMs / attempts` per tombol | "Tombol mana yang memperlambatku?" |

Keduanya sengaja dipisah karena jawabannya sering berbeda — dan perbedaan itulah
informasinya. Pengguna 50 WPM biasanya punya heatmap kesalahan yang hampir bersih dan
heatmap kelambatan yang jelas menyala di kelingking. Kalau kedua heatmap terlihat identik
pada data nyata, salah satunya tidak berguna dan harus ditinjau ulang.

Tombol dengan kemunculan < 10 ditampilkan netral, bukan ekstrem — data kecil jangan
dibaca sebagai diagnosis.

## 10. Streak yang tidak menghukum (R-24)

Streak harian mudah berubah menjadi sumber rasa bersalah, dan itu bertentangan dengan
prinsip produk #3 ("jangan menghukum kesalahan secara emosional").

- Tampilan utama: **grid 30 hari terakhir**, hari berlatih ditandai. Melihat 22 dari 30
  hari terisi terasa seperti pencapaian; melihat "streak: 0" terasa seperti kegagalan.
- Streak berjalan tetap ditampilkan, tapi sebagai angka sekunder.
- **Tanpa animasi patah, tanpa warna menyala, tanpa notifikasi.** Streak yang putus
  hanya berhenti dihitung.

## 11. Nada tulisan

- Ringkas dan faktual. "27 WPM · 92% — butuh 95% untuk lanjut."
- Diagnostik, bukan menghakimi. "Huruf `y` sering meleset" — bukan "Kamu buruk di `y`".
- Tanpa gamifikasi berlebihan: tanpa confetti, tanpa lencana, tanpa poin.
- Nada untuk lesson yang lulus dengan bantuan (dok. 04 §9) tetap jujur dan tidak menghibur
  secara palsu: "Tombol `a` dan `;` masih 78% — itu wajar, kelingking memang paling lambat
  terbentuk. Lanjut dulu, nanti kita kembali ke sini."
