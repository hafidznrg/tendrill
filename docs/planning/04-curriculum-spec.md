# 04 — Curriculum Specification

**Versi:** v4 (kurikulum berjalan di aplikasi) · **Tanggal:** 2026-09-12

Kurikulum adalah *produk*, bukan data pelengkap. Kualitasnya menentukan apakah orang
benar-benar bisa mengetik 10 jari.

> **Catatan revisi v2.** Ditambahkan: Unit 0 placement test (R-14), assist ladder untuk
> pengguna mentok (R-15), review session berjarak (R-16), tabel 30 lesson eksplisit dan
> perbaikan tumpang tindih Unit 3/5 serta pemindahan Shift (R-17), pembobotan latensi (R-18).
>
> **Catatan revisi v4 (Fase 3).** Kurikulumnya sekarang **dijalankan**, bukan hanya
> ada sebagai data. Tiga hal yang belum ditentukan v3 dan baru muncul saat dijalankan
> dicatat di §16, semuanya berpasangan dengan ADR: cara beberapa drill menjadi satu
> sesi (ADR-024), apa yang dihitung sebagai percobaan (ADR-025), dan arti `Shift` di
> dalam generator (ADR-026).
>
> **Catatan revisi v3.** Kurikulumnya sekarang benar-benar ada (§14), dan proses menulisnya
> membongkar enam hal yang salah atau belum ditentukan di v2 — semuanya dicatat di §15.
> Yang terpenting: **kriteria lulus sekarang per-lesson, bukan per-unit** (§4a).

---

## 1. Prinsip penyusunan

1. **Maksimal 2 tombol baru per lesson.** Lebih dari itu, memori otot tidak sempat terbentuk.
2. **Setiap lesson mengulang semua tombol yang sudah dipelajari**, porsi tombol baru ~40%.
3. **Urutan mengikuti kekuatan jari**, bukan alfabet: telunjuk & jari tengah dulu,
   kelingking terakhir.
4. **Akurasi dulu, kecepatan belakangan.** Kecepatan mengikuti akurasi secara otomatis;
   kebalikannya tidak pernah terjadi.
5. **Huruf → suku kata → kata → frasa → kalimat.** Kata nyata baru muncul setelah huruf
   pembentuknya dikuasai.
6. **Yang sudah lulus tetap ditinjau ulang.** Tanpa peninjauan berjarak, Unit 1 sudah luntur
   saat pengguna sampai Unit 4 (R-16).

## 2. Struktur

> **Bagaimana "dalam satu sesi" diwujudkan (ADR-024).** Engine hanya mengenal satu
> `target` per sesi, jadi tiap drill dijalankan sebagai sesi engine sendiri, berurutan
> tanpa layar perantara, lalu digabung `combineResults()` menjadi **satu** hasil
> lesson. Kriteria kelulusan §4a dinilai terhadap gabungan itu — bukan terhadap drill
> terakhir.

```
Curriculum
├── Unit 0  — Placement Test (opsional, 1 sesi)
└── Unit 1..6
    └── Lesson (4–6 per unit)
        └── Drill (3–5 per lesson, dikerjakan berurutan dalam satu sesi)
    └── Review Session (1 di akhir tiap unit)
```

## 3. Unit 0 — Placement Test (R-14)

PRD menempatkan persona "Menengah tersendat (40–55 WPM)" sebagai prioritas.
Memaksa mereka melewati `ff jj dd kk` akan membuat mereka menutup tab dalam satu menit.

**Bentuk.** Satu sesi 60 detik, teks campuran yang menyentuh seluruh keyboard
(huruf semua baris, kapital, tanda baca dasar). Selalu bisa dilewati.

**Keluaran.**

| Hasil | Tindakan |
|---|---|
| < 20 WPM atau < 85% | Mulai dari Unit 1 Lesson 1 |
| 20–34 WPM dan ≥ 85% | Unit 1 ditandai `passed-by-placement`, mulai Unit 2 |
| ≥ 35 WPM dan ≥ 92% | Unit 1–3 `passed-by-placement`, mulai Unit 4 |
| ≥ 55 WPM dan ≥ 95% | Unit 1–5 `passed-by-placement`, mulai Unit 6 + sarankan latihan adaptif |

**Tetap disarankan, tidak pernah dipaksakan.** Kalau profil error menunjukkan gugus tombol
tertentu lemah (mis. semua error terkumpul di baris bawah), tampilkan:
"Unit 3 dilewati, tapi `v c x` masih sering meleset — mau latih itu dulu?"
Pengguna selalu boleh membuka unit mana pun yang sudah dilewati.

Ini sekaligus langsung memenuhi kriteria sukses PRD "pengguna bisa menyebut satu kelemahan
spesifiknya setelah satu sesi" — di sesi pertama.

## 4. Peta unit (revisi)

| Unit | Judul | Tombol / materi baru | Kriteria lulus |
|---|---|---|---|
| **0** | Placement Test | — | tidak ada (diagnostik) |
| **1** | Home Row Foundation | `f j` · `d k` · `s l` · `a ;` · `g h` | 20 WPM · 95% |
| **2** | Top Row | `e i` · `r u` · `t y` · `w o` · `q p` | 25 WPM · 95% |
| **3** | Bottom Row & Shift | `v m` · `c ,` · `x .` · `z /` · `b n` · **Shift + kapital** | 25 WPM · 94% |
| **4** | Words & Rhythm | tanpa tombol baru — kata umum EN, **kalimat berkapital** | 30 WPM · 96% |
| **5** | Punctuation & Sentences | penggunaan `. , ' " ? ! - :` dalam kalimat | 30 WPM · 95% |
| **6** | Numbers & Symbols | baris angka, `@ # $ % & * ( )` | 25 WPM · 93% |

Target akhir kelulusan Unit 6: **≥ 40 WPM, ≥ 95%** pada tes gabungan.

### Perbaikan yang dilakukan di v2 (R-17)

- **Tumpang tindih dihapus.** v1 memperkenalkan `,` `.` `/` di Unit 3 lalu mengklaimnya lagi
  di Unit 5. Sekarang tegas: **Unit 3 mengajarkan posisi fisik** tombol itu sebagai karakter;
  **Unit 5 mengajarkan penggunaannya** sebagai tanda baca di dalam kalimat. Beda materi,
  bukan pengulangan.
- **Shift dipindah maju** dari Unit 5 ke akhir Unit 3. Alasannya sederhana: Unit 4 memakai
  kata dan kalimat nyata, dan kalimat nyata berawalan huruf kapital. v1 diam-diam
  mengharuskan Unit 4 huruf kecil semua tanpa pernah menyatakannya.
- WPM target Unit 6 sengaja lebih rendah — angka dan simbol memang lebih lambat, dan
  menargetkan angka tinggi di situ hanya menghasilkan frustrasi.

## 4a. Kriteria lulus per-lesson (v3)

Kriteria per-unit saja tidak cukup, dan justru berbahaya: menerapkan 25 WPM / 94% yang
sama untuk `u3-l1` (`v m`, telunjuk) dan `u3-l4` (`z /`, kelingking baris bawah) berarti
menuntut angka yang sama untuk dua gerakan yang tingkat kesulitannya jauh berbeda.
Akibatnya bisa ditebak: pengguna mentok berulang kali persis di tombol tersulit, lalu
assist ladder terpicu bukan karena ia butuh bantuan, melainkan karena ambangnya salah.

**Aturannya:** tiap lesson punya `passCriteria` sendiri, lebih longgar pada tombol sulit,
lalu naik sampai **review session menyentuh persis kriteria unit**. Review adalah gerbang
sesungguhnya; lesson individual adalah tanjakan menuju ke sana.

| Lesson | WPM | Akurasi | Alasan angka itu |
|---|---|---|---|
| `u1-l1` … `u1-l3` | 18 | 95% | telunjuk & jari tengah, gerakan termudah |
| `u1-l4` (`a ;`) | **16** | **94%** | kelingking, jari terlemah dan paling lambat terbentuk |
| `u1-l5` (`g h`) | 18 | 95% | julur telunjuk, kembali mudah |
| `u1-review` | **20** | **95%** | = kriteria Unit 1 |
| `u2-l1` … `u2-l4` | 20 → 23 | 94–95% | naik bertahap; `t y` 94% karena julurnya paling jauh |
| `u2-l5` (`q p`) | **20** | **93%** | kelingking di baris atas — gerakan tersulit di unit ini |
| `u2-review` | **25** | **95%** | = kriteria Unit 2 |
| `u3-l1` … `u3-l3` | 20–21 | 93–94% | baris bawah, pergelangan cenderung ikut turun |
| `u3-l4` (`z /`) | **19** | **92%** | pasangan tersulit di seluruh papan |
| `u3-l5` (`b n`) | 22 | 94% | julur telunjuk, lebih mudah dari kelingking |
| `u3-l6` (Shift) | 20 | 93% | chord dua tangan, ritme selalu turun saat pertama |
| `u3-review` | **25** | **94%** | = kriteria Unit 3 |
| `u4-l1` … `u4-l5` | 26 → 30 | 95–96% | tanpa tombol baru; ini satu-satunya unit tempat WPM naik tajam |
| `u4-review` | **30** | **96%** | = kriteria Unit 4, akurasi tertinggi di kurikulum |
| `u5-l1` | 28 | 95% | tanpa tombol baru, murni pemakaian `.` dan `,` |
| `u5-l2` … `u5-l4` | **26** | **94%** | `' " ? ! - :` mayoritas kelingking + Shift |
| `u5-review` | **30** | **95%** | = kriteria Unit 5 |
| `u6-l1`, `u6-l2` | 18 | 93% | baris angka, jangkauan dua baris |
| `u6-l3` (`1 0`) | **16** | **92%** | kelingking ke jangkauan terjauh di papan |
| `u6-l4`, `u6-l5` | **15 → 14** | **92 → 91%** | chord Shift + angka; angka terendah di kurikulum |
| `u6-review` | **25** | **93%** | = kriteria Unit 6 |

Dua batas yang tidak boleh dilanggar dan ditegakkan validator:
- **Akurasi tidak pernah turun di bawah 90%**, di lesson mana pun. Ini penjabaran prinsip #4
  dan konsisten dengan assist ladder (§9) yang menurunkan WPM tapi tidak pernah akurasi.
- **Kriteria lesson tidak boleh melebihi kriteria unitnya**, dan review harus sama persis.

### Kelulusan akhir 40 WPM / 95%

Target ini (§4) **tidak** diukur pada drill angka dan simbol. Mencampur keduanya dalam satu
ambang berarti menghukum kemampuan yang sudah terbentuk gara-gara `%` dan `&` yang memang
lambat untuk semua orang. Karena itu `u6-review` punya dua bagian: drill angka/simbol dinilai
dengan kriteria unit (25 WPM / 93%), sementara **dua drill prosa terakhir** di lesson itulah
tes kelulusan 40 WPM / 95%.

## 5. Tabel lesson lengkap (R-17)

v1 mengklaim "28 lesson" tanpa daftar yang bisa dicocokkan. Berikut daftar mengikatnya:
**Unit 0 + 30 lesson + 6 review session.**

| Id | Unit | Judul | Tombol baru |
|---|---|---|---|
| `u0-placement` | 0 | Placement Test | — |
| `u1-l1` | 1 | Keys F and J | `f j` |
| `u1-l2` | 1 | Keys D and K | `d k` |
| `u1-l3` | 1 | Keys S and L | `s l` |
| `u1-l4` | 1 | Keys A and Semicolon | `a ;` |
| `u1-l5` | 1 | Keys G and H | `g h` |
| `u1-review` | 1 | Home Row Review | — |
| `u2-l1` | 2 | Keys E and I | `e i` |
| `u2-l2` | 2 | Keys R and U | `r u` |
| `u2-l3` | 2 | Keys T and Y | `t y` |
| `u2-l4` | 2 | Keys W and O | `w o` |
| `u2-l5` | 2 | Keys Q and P | `q p` |
| `u2-review` | 2 | Top Row Review | — |
| `u3-l1` | 3 | Keys V and M | `v m` |
| `u3-l2` | 3 | Keys C and Comma | `c ,` |
| `u3-l3` | 3 | Keys X and Period | `x .` |
| `u3-l4` | 3 | Keys Z and Slash | `z /` |
| `u3-l5` | 3 | Keys B and N | `b n` |
| `u3-l6` | 3 | Shift and Capitals | `Shift` |
| `u3-review` | 3 | Full Alphabet Review | — |
| `u4-l1` | 4 | Common Words I | — |
| `u4-l2` | 4 | Common Words II | — |
| `u4-l3` | 4 | Word Pairs & Rhythm | — |
| `u4-l4` | 4 | Short Sentences | — |
| `u4-l5` | 4 | Paragraph Flow | — |
| `u4-review` | 4 | Rhythm Review | — |
| `u5-l1` | 5 | Period and Comma in Context | — |
| `u5-l2` | 5 | Apostrophe and Quotes | `' "` |
| `u5-l3` | 5 | Question and Exclamation | `? !` |
| `u5-l4` | 5 | Hyphen and Colon | `- :` |
| `u5-review` | 5 | Punctuation Review | — |
| `u6-l1` | 6 | Number Row: 4 5 6 7 | `4 5 6 7` |
| `u6-l2` | 6 | Number Row: 3 8 2 9 | `3 8 2 9` |
| `u6-l3` | 6 | Number Row: 1 0 | `1 0` |
| `u6-l4` | 6 | Symbols: @ # $ % | `@ # $ %` |
| `u6-l5` | 6 | Symbols: & * ( ) | `& * ( )` |
| `u6-review` | 6 | Final Mixed Test | — |

Validasi otomatis wajib (dok. 09): id unik, urutan tidak bolong, setiap `newKeys` ada di
peta layout, dan setiap `reviewKeys` benar-benar sudah diperkenalkan di lesson sebelumnya.

## 6. Anatomi satu lesson

```ts
interface Lesson {
  id: string;               // "u1-l3"
  unitId: string;
  order: number;
  kind: 'lesson' | 'review' | 'placement';
  title: string;
  newKeys: string[];
  reviewKeys: string[];
  drills: Drill[];
  passCriteria: { minWpm: number; minAccuracy: number };
  intro?: string;           // 1-2 kalimat panduan posisi jari
}

interface Drill {
  type: 'letters' | 'syllables' | 'words' | 'phrases' | 'sentences';
  generator: 'static' | 'weighted-random';
  content?: string;
  length?: number;
}
```

### Contoh konkret — `u1-l3`

```
title: "Keys S and L"
newKeys: ["s", "l"]
reviewKeys: ["f", "j", "d", "k"]
intro: "Jari manis kiri ke S, jari manis kanan ke L. Jempol tetap di spasi."

drill 1 (letters, static):
  ss ll ss ll sl ls sl ls ss ll sl ls

drill 2 (letters, weighted-random, 120 char):
  campuran s l f j d k — bobot: s/l = 2.0, sisanya = 1.0

drill 3 (letters, static):
  sd lk sd lk ds kl ds kl sf lj fs jl

drill 4 (syllables, static):
  sdf lkj fds jkl sdfl lkjs dslf klfj sfd ljk
```

> **Perbaikan v3.** Contoh v1/v2 di sini memakai kata `sad lad ask all fall flask salad`
> pada `u1-l3` — padahal `a` baru diperkenalkan di `u1-l4`. Semua kata itu **mustahil**
> diketik pada lesson tersebut. Konsekuensinya melampaui satu contoh: **`f j d k s l` tidak
> membentuk satu pun kata Inggris**, karena tidak ada vokal di dalamnya. Jadi `u1-l1`
> sampai `u1-l3` memang murni letters/syllables, dan kata nyata baru mungkin mulai `u1-l4`.
> Itu bukan kekurangan — tiga lesson pertama melatih anchoring jari, bukan makna.

## 7. Review session (R-16)

Sekali lulus, sebuah lesson tidak pernah muncul lagi di rencana v1 — padahal memori otot
butuh peninjauan berjarak. Unit 4 mengasumsikan Unit 1–3 masih melekat, padahal bisa jadi
sudah dua minggu berlalu.

**Bentuk.** Satu lesson `kind: 'review'` di akhir tiap unit:
- Drill dihasilkan generator berbobot dari **semua tombol yang sudah dipelajari**.
- Bobotnya bukan seragam, melainkan diambil dari **statistik nyata pengguna**
  (`errorsByKey` + `latencyByKey` dari `keystats`). Review-nya jadi personal, bukan generik.
- Kriteria lulus = rata-rata kriteria unit-unit yang ditinjau.
- Jika `keystats` masih kosong (pengguna baru), jatuh ke bobot seragam.

Biaya implementasi hampir nol: generator berbobot sudah ada di §8.

## 8. Generator drill berbobot (revisi, R-18)

Dipakai untuk drill dinamis, review session, dan latihan adaptif.

```
weight(key) = baseWeight(key) × errorMultiplier(key) × latencyMultiplier(key)

baseWeight:        2.0 untuk newKeys, 1.0 untuk reviewKeys
errorMultiplier:   1 + (errorRate(key) × 3),            dijepit ke [1, 4]
latencyMultiplier: 1 + ((meanMs(key) / medianMs) - 1),  dijepit ke [1, 2.5]
```

`latencyMultiplier` adalah tambahan v2. Pengguna 50 WPM biasanya **tidak banyak salah** —
mereka lambat di tombol tertentu. Tanpa faktor ini, generator buta terhadap masalah utama
persona prioritas kedua. Faktornya diberi rentang lebih sempit daripada error karena
kesalahan tetap lebih penting daripada kelambatan.

**`Shift` bukan karakter (ADR-026).** Kalau `Shift` ada di `newKeys`/`reviewKeys`,
generator tidak pernah menuliskannya; ia menambahkan varian **kapital** dari huruf
yang sudah menjadi kandidat, dengan bobot **separuh** bobot huruf kecilnya. Bobot
penuh membuat drill berubah menjadi mayoritas chord dua tangan.

Aturan agar hasilnya tidak terasa acak-brutal:
- Jangan menghasilkan huruf yang sama tiga kali berturut-turut.
- Kelompokkan jadi "kata" 3–5 huruf dipisah spasi — aliran huruf tanpa spasi tidak
  melatih ritme.
- Panjang drill default 120–200 karakter (≈30–60 detik untuk pemula).

## 9. Assist ladder — pengguna yang mentok (R-15)

Ini penyebab dropout nomor satu, dan v1 sama sekali tidak membahasnya. Pemula yang gagal
delapan kali di Lesson 3 tidak punya jalan keluar selain menyerah.

| Percobaan | Tindakan |
|---|---|
| 1–2 | Normal |
| 3 | Diagnosis ditampilkan lebih menonjol + tawarkan drill mikro khusus tombol yang gagal |
| 4–5 | Target WPM diturunkan 20%. **Akurasi tidak diturunkan.** |
| ≥ 6 | Tawarkan "lanjut saja": lesson ditandai `passed-with-assist`, dicatat di progres, dan tombol-tombolnya masuk antrean latihan adaptif |

Prinsipnya: **akurasi tidak pernah dikompromikan, kecepatan boleh menunggu** — selaras
dengan prinsip #4. Yang lulus dengan bantuan tidak disembunyikan: `/learn` menandainya
halus, dan review session akan menagihnya kembali.

Nada pesannya tetap diagnostik, bukan menghibur secara palsu:
"Tombol `a` dan `;` masih 78% — itu wajar, kelingking memang paling lambat terbentuk.
Lanjut dulu, nanti kita kembali ke sini."

## 10. Latihan adaptif (P1)

Setelah pengguna punya ≥ 5 sesi tersimpan:

1. Ambil `errorsByKey` **dan `latencyByKey`** teragregasi dari 20 sesi terakhir.
2. Pilih 5 tombol dengan skor gabungan terburuk (minimal 10 kemunculan supaya tidak bias
   data kecil).
3. Bangun drill dengan generator berbobot (§8) memakai 5 tombol itu + huruf frekuensi
   tinggi sebagai pengisi.
4. Kalau ada, pakai **kata nyata** yang mengandung tombol-tombol itu — jauh lebih efektif
   daripada huruf acak.
5. (P1+) Kalau data bigram tersedia, sisipkan kata yang mengandung transisi paling lambat.

## 11. Sumber konten (bahasa Inggris)

| Kebutuhan | Sumber | Catatan lisensi |
|---|---|---|
| Daftar kata umum | Google 10.000 English words (MIT) atau daftar frekuensi buatan sendiri | Aman |
| Kata per gugus huruf | Difilter sendiri dari daftar di atas **saat build** (R-12) | Aman |
| Kutipan / kalimat | Domain publik (Aesop, Gutenberg) atau tulis sendiri | **Jangan** menyalin dari aplikasi lain |
| Pangram & kalimat latihan | Tulis sendiri | Aman |

Semua konten adalah file data statis di repo (`src/data/`), **tidak pernah di-fetch runtime**.
Asal dan lisensi tiap sumber dicatat di `src/data/LICENSES.md`.

### Pipeline build wordlist (R-12)
Daftar 10.000 kata tidak dikirim mentah ke browser. `scripts/build-wordlists.ts` memfilternya
per gugus huruf per unit menjadi file kecil: Unit 1 tidak perlu membawa kata yang
mengandung `z`.

## 12. Persiapan multi-bahasa (untuk ID nanti)

```
src/data/
  curriculum/
    en/
      units.ts
      lessons/
      wordlists/
    (id/ menyusul)
```

Tipe `Lesson` tidak boleh memuat teks UI. Judul dan intro disimpan sebagai key i18n atau
field per-locale. Keputusan ini murni struktural — tidak perlu memasang library i18n sekarang.

## 13. Pekerjaan non-koding (deliverable terpisah)

Ini memakan waktu nyata dan **tidak bergantung pada kode sama sekali** — karena itu bisa
dicicil sejak hari pertama, di sela fase koding (R-23).

- [x] Tulis teks placement test Unit 0
- [x] Tulis 30 lesson lengkap dengan isi drill-nya
- [x] Kurasi daftar kata per gugus huruf (Unit 1–3)
- [ ] Tulis / kumpulkan 100+ kalimat latihan untuk Unit 4–5
- [x] Tulis teks intro posisi jari untuk tiap lesson
- [ ] Tulis **panduan postur & anchoring awal** (tonjolan F/J, posisi pergelangan,
      "jangan melihat keyboard") — ditampilkan sekali sebelum `u1-l1`, bisa dilewati
- [ ] Uji sendiri seluruh kurikulum dari awal sampai akhir sebelum rilis

---

## 14. Implementasi (v3)

Kurikulumnya sudah ditulis lengkap dan bisa diperiksa mesin.

```
src/data/curriculum/en/
├── types.ts                 # Lesson, Drill, Unit, Curriculum
├── units.ts                 # 7 unit + kriteria lulus unit
├── index.ts                 # gabungan, getLesson, keysIntroducedThrough
└── lessons/
    ├── unit-0.ts            # placement test
    └── unit-1.ts … unit-6.ts

src/data/wordlists/en/
└── index.ts                 # pool common-100, common-200,
                             # sentences-basic, sentences-punct

scripts/validate-curriculum.ts
```

Isinya: **1 placement + 30 lesson + 6 review**, 55 karakter diperkenalkan,
±14.900 karakter isi drill statis, ditambah drill dinamis.

### Validator

```bash
node --experimental-strip-types scripts/validate-curriculum.ts
```

Nanti dipanggil ulang sebagai test Vitest dan **wajib jadi gerbang CI** (dok. 09).
Yang diperiksa:

1. Id unik; `unitId` dikenal; `order` tidak bolong; review selalu lesson terakhir di unitnya.
2. Setiap `newKeys` ada di layout QWERTY US dan belum pernah diperkenalkan sebelumnya.
3. Setiap `reviewKeys` benar-benar sudah diperkenalkan lesson sebelumnya.
4. Maksimal 2 tombol baru per lesson (kecuali Unit 6, §15 poin 4).
5. **Aturan kumulatif** — tidak satu pun karakter di drill boleh memakai tombol yang belum
   diajarkan. Ini pemeriksaan terpenting: sekali sebuah lesson meminta huruf yang belum
   diajarkan, seluruh janji "berjenjang" batal. Isi **pool wordlist ikut diperiksa**
   terhadap tombol yang tersedia di lesson pemakainya, sehingga drill yang dibangkitkan
   runtime tunduk pada aturan yang sama.
6. Kriteria lulus: review == kriteria unit, lesson <= kriteria unit, akurasi >= 90%.
7. Jumlah lesson persis 1 + 30 + 6; tiap lesson punya `intro` dan minimal 3 drill.
8. Seluruh 26 huruf benar-benar pernah diajarkan.

Pemeriksaan nomor 5 sudah menangkap empat bug nyata saat kurikulum ini ditulis
(`u2-l1` memakai `t`, `u2-l2` memakai `n` dan `o`, `u3-l2` dan `u3-l4` memakai `n`
sebelum tombolnya diajarkan) — semuanya lolos dari mata manusia.

## 15. Koreksi terhadap v2 yang muncul saat menulis kurikulum

1. **Contoh `u1-l3` salah** — memakai kata ber-`a` sebelum `a` diajarkan. Diperbaiki di §6,
   berikut penjelasan kenapa tiga lesson pertama tidak bisa punya kata nyata sama sekali.
2. **Kriteria lulus per-unit tidak memadai** — jadi per-lesson dengan ramp (§4a).
3. **`newKeys` adalah KARAKTER, bukan tombol fisik.** `"` `?` `!` `@` diajarkan sebagai
   chord Shift, dan mengajarkan `!` **tidak** membuka `1`. Hanya `Shift` yang berperilaku
   sebagai pseudo-key: ia membuka huruf kapital dari huruf kecil yang sudah diperkenalkan.
   Tanpa pembedaan ini, validator akan meloloskan angka di Unit 5.
4. **Unit 6 dikecualikan dari batas 2 tombol baru.** Angka dipelajari berpasangan simetris
   (`4 5 6 7` = dua telunjuk, `3 8` = dua jari tengah). Memecahnya jadi 2 tombol memisahkan
   pasangan kiri/kanan yang justru memudahkan hafalan, dan menambah lima lesson tanpa
   manfaat. Pengecualian ini eksplisit di validator, bukan diam-diam.
5. **`Drill` bertambah field `pool?: string`.** Untuk `type: 'words' | 'phrases' | 'sentences'`
   dengan `generator: 'weighted-random'`, generator menyampel dari wordlist, bukan menyusun
   huruf acak — sesuai §10 langkah 4 yang menyebut "pakai kata nyata". Tanpa field ini,
   §10 tidak bisa diimplementasikan.
6. **Kelulusan 40 WPM / 95% dipisahkan dari drill angka/simbol** (§4a bagian akhir).

Yang **tidak** berubah: urutan unit, pemindahan Shift ke Unit 3, pembagian tugas `,` `.` `/`
antara Unit 3 dan Unit 5, dan seluruh mekanisme placement / assist ladder / review.

---

## 16. Yang baru ditentukan saat kurikulum dijalankan (v4)

Ketiganya adalah lubang yang tidak terlihat selama kurikulum masih berupa data saja.

1. **Beberapa drill → satu sesi** (ADR-024). Satu sesi engine per drill, hasil
   lesson = gabungannya, kelulusan dinilai terhadap gabungan. `Tab` mengulang lesson
   dari drill pertama, bukan drill yang sedang berjalan.
2. **Apa yang dihitung sebagai percobaan** (ADR-025) — penggerak seluruh assist
   ladder §9, dan v3 tidak pernah menyebutkannya. Yang **tidak** dihitung: sesi yang
   di-void (> 30 detik diam) dan drill mikro. Gagal setelah pernah lulus juga tidak
   mencabut kelulusan.
3. **`Shift` di generator** (ADR-026) — §8 di atas.

Ditambah satu aturan uji yang sekarang mengikat: **aturan kumulatif §5 nomor 5 juga
diperiksa untuk teks yang dibangkitkan runtime**, bukan hanya untuk isi statis dan
pool. Validator tidak bisa melihat teks yang baru lahir saat pengguna membuka lesson;
`src/features/curriculum/__tests__/drills.test.ts` menutup celah itu untuk ke-36
lesson non-placement, dengan dan tanpa statistik pengguna, dan gerbangnya sudah
dibuktikan merah dengan kontrol negatif.
