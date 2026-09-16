# 07 — UX / UI Specification

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

> **Catatan revisi v2.** Ditambahkan aturan tata letak baris yang deterministik (R-07),
> pengukuran font sebelum caret dipasang (R-06), heatmap latensi (R-18), dan streak yang
> tidak menghukum (R-24).

## 1. Prinsip desain

1. **Layar sesi adalah produknya.** Semua halaman lain hanya pengantar ke sana. Saat sesi berjalan, tidak ada elemen yang bergerak selain caret dan angka metrik.
2. **Tidak ada layout shift.** Angka metrik memakai font tabular; teks target punya tinggi tetap. Karakter salah tidak boleh mengubah lebar.
   Termasuk **lahirnya scrollbar**: `html` memesan `scrollbar-gutter: stable` supaya
   halaman yang tiba-tiba melewati tinggi layar — layar hasil di akhir sesi — tidak
   menyempitkan viewport dan menggeser seluruh isi yang di-`mx-auto`. Terukur −7,6 px
   sebelum diperbaiki (2026-09-11).
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
│   Telunjuk kiri di F, kanan di J.       [selengkapnya]│  ← intro, satu baris (ADR-041)
│   [strict|bebas]  12wpm · 90% · Tab ulangi · Esc keluar│  ← petunjuk, sangat redup
└──────────────────────────────────────────────────────┘
```

Aturan:
- Teks target maksimal **3 baris terlihat**; saat baris pertama selesai, teks bergulir naik
  satu baris (bukan per karakter).
- Lebar baris **50–60 karakter**, *selama kotaknya memang memuat sebanyak itu*. Angkanya
  **diturunkan dari pengukuran**, bukan dikonstankan (ADR-028):
  `cols = clamp(floor(lebarTeks / charWidth), 20, 60)`. Pada lebar default aplikasi
  (`max-w-3xl` − `px-6` = 720 px, `charWidth` 14,4 px) hasilnya **50**. Konstanta 52 yang
  dipakai sampai 2026-09-12 tidak pernah muat, dan caret meleset satu baris karenanya.
  Lebih panjang dari 60 membuat mata kesulitan kembali ke awal baris; lebih pendek dari
  50 hanya terjadi di jendela sempit, dan itu lebih baik daripada caret yang salah.
- Metrik live diletakkan **jauh dari teks** supaya tidak mencuri perhatian saat mengetik.

### Apa yang boleh berada di atas area teks (ADR-041)

**Tidak ada, selain bilah metrik.** Intro lesson dan paragraf pengantar `/placement` berada
di **bawah** keyboard, bergabung dengan baris footer. Alasannya mekanis, bukan kerapian:
apa pun yang muncul atau hilang di bawah keyboard tidak menggeser area teks, sedangkan blok
di atasnya menggeser seluruh panggung — kelas bug yang tiga kali lolos di Fase 2 (dok. 08).

- Intro ditulis **satu baris**, 13 px, `--fg-dim`, bar aksen kiri dipertahankan. Kalimat
  berikutnya disembunyikan di balik `<details>`; ringkasannya selalu satu baris.
- Intro **tidak** disembunyikan pada keystroke pertama: itu satu re-render React di jalur
  input, dan gerbang nol re-render (dok. 08 Fase 1) lebih mahal daripada sebaris teks redup.
- Rute sesi memakai `py-6`, bukan `py-10`.

### Layar hasil adalah overlay, bukan blok berikutnya (ADR-041)

`ResultScreen` dirender **di atas** area teks + keyboard, di dalam pembungkus `relative`
yang sama — pola yang sudah dipakai overlay `status === 'paused'`. Panggung tetap
ter-*mount*: meng-unmount-nya membuang sesi engine dan memaksa `VirtualKeyboard` mengukur
ulang rect tombol yang dipakai siluet tangan (ADR-036).

- Scrim `--bg` 94% — konteks di belakang masih terbaca samar.
- Panel: `max-height: 100%` + `overflow-y: auto`. Cabang assist ladder terpanjang menggulir
  **di dalam panel**, tidak pernah menggulir halaman.
- `role="dialog"`, `aria-modal="false"`, fokus pindah ke panel saat muncul. Pintasan
  Enter / N / Esc tidak berubah.
- Berlaku di `/learn/:id`, `/practice`, `/practice/adaptive`. `/placement` hasilnya halaman
  sendiri dan tidak memakai overlay.

### Pembungkusan baris bersifat deterministik, bukan CSS (R-07)

Baris ditentukan oleh `wrapText(target, cols)` di engine (dok. 03 §8), **bukan** oleh
pembungkusan otomatis browser. Karena itu `.ta-text` memakai `white-space: pre` — bukan
`pre-wrap` (ADR-028): `pre-wrap` tetap mengizinkan browser memotong baris saat kotaknya
kurang lebar, dan potongan yang tidak diketahui engine membuat caret meleset **tanpa satu
pun tanda**. Dengan `pre`, ketidakcocokan berubah menjadi teks yang terpotong di tepi —
kelihatan, dan caretnya tetap benar. Alasannya bukan estetika melainkan mekanis: kalau CSS yang
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

### Siluet tangan (ADR-036)

Warna jari menjawab *jari mana yang bertanggung jawab*; siluet menjawab *di mana tangan
beristirahat* dan *ke mana jari menjangkau*. `h` dan `j` berwarna sama — hanya siluet
yang memperlihatkan telunjuk kanan bertumpu di `j`.

- **Bentuk** (ADR-037, menggantikan bentuk prosedural ADR-036): dua tangan dari **gambar
  pose per tombol** (`finger-svg-tendrill/` → `src/data/hands/poses.ts`), bukan kurva
  rumus. Tiap tombol punya pose sendiri — tangannya benar-benar menjangkau, bukan tangan
  diam yang jarinya diwarnai. Tanpa karakter aktif: pose istirahat kedua tangan.
- **Letak tetap diturunkan dari geometri tombol** (hibrida): pose disimpan di *ruang
  keyboard* (1 tombol = 32 satuan) dan dipetakan ke tombol yang diukur lewat satu affine
  per pengukuran. Ujung jari aktif tiap pose **dijamin di dalam tombolnya** — oleh
  generator dan oleh `hands.test.ts`.
- **Warna**: kulit `--fg-dim` transparan, garis tepi `--fg` tipis, jari aktif garis
  `--accent` pekat dengan lapisan aksen lebar tipis di bawahnya. Tebal garis tidak ikut
  skala (`vector-effect: non-scaling-stroke`). Pergelangan memudar ke bawah.
- **Jari aktif**: pose tangan yang mengetik huruf; untuk karakter ber-Shift, tangan
  sisi berlawanan memakai pose Shift-nya. Spasi memakai pose jempol kanan.
- **Panah jangkauan** (garis melengkung + mata panah) dari ujung jari di home row ke
  tombol tujuan. Tidak tampil kalau tujuan = tombol istirahat jari itu, atau spasi.
- **Tidak menghalangi**: label tombol tetap terbaca, `pointer-events: none`,
  `aria-hidden` (ikut keyboard).
- **Ruang dipesan sejak paint pertama**: telapak tangan menjulur di bawah keyboard ke
  ruang yang tingginya sudah ditetapkan saat render — bukan setelah pengukuran.
- **Jalur keystroke**: sama seperti sorotan tombol — penulisan atribut `d` imperatif pada
  elemen yang dicari sekali saat mount, dengan string pose yang sudah ada di modul data
  (≤ 4 `d` + 1 `data-pose` per tangan, hanya kalau posenya berganti). Affine dihitung saat mount/resize,
  bukan per keystroke. Data pose (~28 KB gzip) dimuat lewat `import()` dinamis hanya
  saat siluet diminta. Pengukuran posisi tombol (`offsetLeft`) hanya di mount dan
  `ResizeObserver`, **tidak pernah** di jalur input.
- **Di mana tampil**:

  | Halaman | Siluet |
  |---|---|
  | `/learn/:id` (lesson & review) | selalu |
  | `/posture` | selalu |
  | `/practice`, `/practice/adaptive` | pilihan pengguna, **default mati**; sakelar di bawah keyboard dan di `/settings` |
  | `/placement` | tidak — placement mengukur, bukan mengajar |

### `/posture` dapat dijelajah per tombol (ADR-038)

- **Tekan tombol di keyboard fisik** atau **arahkan kursor ke tombol di layar**: tombol
  itu disorot, tangan berpindah ke posenya, panah jangkauan tampil. Shift + huruf
  menampilkan kedua tangan.
- Kursor keluar dari keyboard → kembali ke tombol fisik terakhir, atau posisi istirahat.
- Tab, Enter, dan kombinasi Ctrl/Alt/Meta tidak ditangkap, begitu pula apa pun selama
  fokus di isian teks. Selama fokus di tombol/tautan, Spasi dilepas; huruf tetap ditangkap.
- Satu baris keterangan `aria-live="polite"` di bawah keyboard: "**E** — jari tengah kiri,
  dijangkau dari **D**"; untuk tombol istirahat: "**J** — tempat istirahat telunjuk
  kanan". Sebelum ada pilihan: ajakan "Tekan tombol apa pun, atau arahkan kursor ke
  tombol, untuk melihat jarinya."
- **"Lihat bedanya"** (tombol teks, bukan tautan navigasi) hanya di butir 4 (`h` lalu
  `j`) dan butir 5 (Backspace). Tanpa animasi berulang.
- Hanya `/posture`. Layar sesi tidak pernah memasang mode ini.
- **Peta jari per tombol** (sesudah keenam butir): 9 kartu 3×3 — kiri, lalu telunjuk
  kiri · jempol · telunjuk kanan, lalu kanan. Tiap kartu: keyboard mini statis dengan
  tombol milik jari itu berwarna jari, siluet pose jari itu di tombol istirahatnya, dan
  chip tombol (klik → tampil di keyboard interaktif). Tanpa pengukuran DOM; ruang
  siluet dipesan lewat `viewBox`.
- **Tata letak `/posture`** (ADR-038 poin 12): satu-satunya halaman selebar `max-w-6xl`.
  ≥ 1100 px dua kolom — kiri panduan + keyboard (lebar tetap), kanan peta jari *sticky* (hanya kalau layar ≥ 46rem tingginya; tidak pernah bergulir sendiri);
  di bawahnya satu kolom dengan peta sesudah butir.

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

**Skala warna (ADR-033).** Kesalahan berskala absolut (15% = penuh); kelambatan
berskala relatif terhadap median tombol pengguna sendiri (1,6× median = penuh). Empat
pita dibulatkan ke bawah, jadi selisih kecil dari acuan tetap netral. Karakter digabung
per tombol fisik (`a` + `A`). Kesalahan memakai `--error`, kelambatan `--caret`.

## 10. Streak yang tidak menghukum (R-24)

Streak harian mudah berubah menjadi sumber rasa bersalah, dan itu bertentangan dengan
prinsip produk #3 ("jangan menghukum kesalahan secara emosional").

- Tampilan utama: **grid 30 hari terakhir**, hari berlatih ditandai. Melihat 22 dari 30
  hari terisi terasa seperti pencapaian; melihat "streak: 0" terasa seperti kegagalan.
- Streak berjalan tetap ditampilkan, tapi sebagai angka sekunder.
- **Tanpa animasi patah, tanpa warna menyala, tanpa notifikasi.** Streak yang putus
  hanya berhenti dihitung.

## 10a. Beranda `/` (ADR-039)

```
┌ header ─────────────────────────────────────────────────────────────┐
│  LABEL                             ┌ panel home row statis ───────┐ │
│  Mengetik tanpa lihat keyboard     │ a s d f   j k l ;            │ │
│                                    │ (tonjolan f/j, d l beraksen) │ │
│  pengantar (4 kalimat pendek)      │ fjfj dkdk ▌jf kd             │ │
│  [tombol utama] [tombol kedua]     └──────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  baru:    tiga fakta satu baris                                     │
│  kembali: PROGRESMU — kartu lesson berikutnya (lebar penuh)         │
│           [WPM 7 hari] [tombol terlemah] [hari berlatih]            │
└─────────────────────────────────────────────────────────────────────┘
```

- Isi dibatasi 1040 px; menumpuk satu kolom di bawah ~900 px.
- Satu tombol utama (isi `--accent`); tombol lain bergaris `--line`.
- Kartu: `--surface-2`, garis `--line`, radius 6 px; label kartu mono 11 px huruf besar.
- Garis mini WPM digambar SVG sendiri; hari tanpa latihan tidak diberi titik.
- Salinan teksnya mengikuti ADR-040: kalimat pendek, kosakata netral, bentuk pasif
  kalau yang penting hasilnya dan bukan siapa pelakunya.

## 11. Nada tulisan

- Ringkas dan faktual. "27 WPM · 92% — butuh 95% untuk lanjut."
- Kalimat pendek, satu gagasan satu kalimat. Kalimat majemuk bertingkat dipecah, bukan
  disambung dengan tanda pisah.
- Bentuk pasif dipakai kalau yang penting hasilnya: "Progres disimpan di browser ini saja",
  bukan "Kami menyimpan progresmu di browser ini saja".
- Judul dan label tidak ditulis sebagai frasa benda abstrak ("Menyasar kelemahanmu");
  sebutkan hal yang terjadi ("Ikut tombol yang sering salah").
- Diagnostik, bukan menghakimi. "Huruf `y` sering meleset" — bukan "Kamu buruk di `y`".
- Tanpa gamifikasi berlebihan: tanpa confetti, tanpa lencana, tanpa poin.
- Nada untuk lesson yang lulus dengan bantuan (dok. 04 §9) tetap jujur dan tidak menghibur
  secara palsu: "Tombol `a` dan `;` masih 78% — itu wajar, kelingking memang paling lambat
  terbentuk. Lanjut dulu, nanti kita kembali ke sini."
