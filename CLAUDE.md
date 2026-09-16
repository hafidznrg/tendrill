# tendrill — instruksi kerja untuk agent

Aplikasi belajar mengetik sepuluh jari. Tanpa backend, tanpa auth, desktop-first,
semua data di `localStorage`. Bahasa dokumen & komentar: **Indonesia**. Bahasa konten
latihan: **Inggris**.

## 1. Rencananya sudah ada. Baca dulu, jangan karang.

`docs/planning/` adalah **kontrak**, bukan dokumentasi tambahan. Sebelum menulis kode:

| Kalau menyentuh…               | Wajib baca                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| apa pun                        | [00-README](docs/planning/00-README.md), [08-roadmap](docs/planning/08-roadmap.md)                       |
| engine, WPM, akurasi, input    | [03-typing-engine-spec](docs/planning/03-typing-engine-spec.md)                                          |
| lesson, unit, drill, kelulusan | [04-curriculum-spec](docs/planning/04-curriculum-spec.md)                                                |
| localStorage, migrasi          | [05-data-model](docs/planning/05-data-model.md)                                                          |
| struktur folder, stack, chunk  | [06-architecture](docs/planning/06-architecture.md)                                                      |
| layout, warna, tema, a11y      | [07-ux-ui-spec](docs/planning/07-ux-ui-spec.md), [12-brand-identity](docs/planning/12-brand-identity.md) |
| test                           | [09-testing-plan](docs/planning/09-testing-plan.md)                                                      |
| "kenapa begini?"               | [10-decisions](docs/planning/10-decisions.md), [11-plan-review](docs/planning/11-plan-review.md)         |

Kalau dok. 07 dan dok. 12 berbeda soal warna, **dok. 12 menang**.

## 2. Kerjakan fase berurutan

Status sekarang (2026-09-16): **Fase 8 — kode selesai, DoD menunggu pemilik.** Sesudahnya,
atas permintaan pemilik, dikerjakan berturut-turut dan **sudah di-push** ke `origin/main`:
siluet tangan (ADR-036→037, `071fc00`/`b605264`), `/posture` yang dapat dijelajah (ADR-038,
`c5a475f`), beranda dengan dashboard progres (ADR-039, `abb8c5e`) dan salinan teksnya
(ADR-040, `f777f9d`), lalu tata ulang layar sesi (ADR-041, `8425b51`). Tidak ada pekerjaan
kode yang menggantung; yang tersisa hanya butir yang **tidak bisa dikerjakan agent**:

| Butir yang menunggu pemilik | Asal |
|---|---|
| Uji pakai ≥ 3 orang, Lighthouse, ulang `autotype()`/`watchRealInput()`, deploy | Fase 8 |
| Apakah siluet membantu pemula, dan bentuknya pas di layar sungguhan (termasuk 11 pose yang diputar generator) | ADR-036/037 |
| Apakah menjelajah `/posture` membantu, atau mengalihkan dari "raba, jangan lihat" | ADR-038 |
| Konfirmasi lisensi aset siluet (sumber bergelar "VocaType") | ADR-037 |
| Apakah hero yang sama tiap kunjungan membantu, atau mendorong dashboard terlalu ke bawah | ADR-039 |
| Apakah teks beranda yang dipendekkan masih punya karakter, atau jadi datar | ADR-040 |
| Apakah hasil yang menutup teks membantu atau mengagetkan, dan apakah intro satu baris di bawah keyboard masih terbaca pemula | ADR-041 |
| Menyelesaikan sendiri Unit 1–3 dan menilai keadilan kriteria lulus | Fase 4 |
| Heatmap latensi menyorot tombol yang *terasa* lambat | Fase 6 |
| Drill adaptif *terasa* menyasar kelemahan | Fase 7 |

Yang mengikat dari Fase 8 (ADR-035): suara ketik **lazy dan mati default** (satu-satunya
alokasi per keystroke yang disengaja), `DesktopOnly` diputuskan **sekali saat mount**
(bukan `resize` — ADR-028), tema dicerminkan ke ekspor di `exportAll` (bukan di toggle —
itu menarik storage ke bundel awal), dan atap bundel awal **90 KB**.

**Tata letak layar sesi (ADR-041).** Dua aturan yang mudah dirusak tanpa sadar, karena
keduanya soal *posisi* dan kodenya tetap "jalan" kalau dilanggar:
- **Di atas area teks hanya ada bilah metrik.** Intro lesson dan pengantar `/placement`
  hidup di slot `footer` `TypingStage` — di bawah keyboard. Yang muncul/hilang di sana tidak
  menggeser panggung; blok di atasnya menggeser semuanya. Intro **tidak** disembunyikan pada
  keystroke pertama: itu satu re-render React di jalur input.
- **Layar hasil adalah `overlay`, bukan blok sesudah panggung**, dan panggungnya **tidak
  di-unmount** — meng-unmount-nya membuang sesi engine dan memaksa `VirtualKeyboard`
  mengukur ulang rect tombol yang dipakai siluet tangan. Panel menggulir di dalam dirinya
  sendiri, tidak pernah menggulir halaman. Berlaku di `/learn/:id`, `/practice`,
  `/practice/adaptive`; `/placement` hasilnya halaman sendiri.
Keduanya dijaga `learnFlow.test.tsx` (urutan DOM dan induk overlay, dengan kontrol negatif).

**Siluet tangan (ADR-036 → ADR-037).** *Bentuk* datang dari pose SVG per tombol, *letak*
tetap dari tombol yang diukur:
- `finger-svg/` (aset mentah) **di-ignore**; yang di-commit hanya `finger-svg-tendrill/`.
  Alurnya: `scripts/build-hand-svg-theme.mjs` → `scripts/build-hand-poses.ts` →
  `src/data/hands/poses.ts` (**jangan disunting tangan**, ada di `.prettierignore`).
- `hands.ts` (pure) mem-fit affine ruang keyboard → tombol terukur, hanya saat
  mount/`ResizeObserver`. Jalur keystroke hanya menulis `d` dengan string yang sudah ada,
  dan hanya kalau pose berganti. Pose istirahat dilukis di layout effect.
- Ujung jari aktif setiap pose wajib di dalam tombolnya — digerbangi generator dan
  `hands.test.ts` (dengan kontrol negatif).
- Data pose ~27 KB **hanya lewat `loadHandPoses()`**, dijaga `chunkgraph` (`LAZY_ONLY`).
- Selalu di `/learn/:id` dan `/posture`; opsional di `/practice` (`showHandsInPractice`,
  default mati); tidak pernah di `/placement`.

**`/posture` (ADR-038).**
- Keyboard fisik + hover lewat hook `useKeyExplorer` — **hanya `/posture` yang
  memasangnya**; jangan dijadikan mode di `VirtualKeyboard` (layar sesi tidak boleh
  mendapat listener baru). Tab/Enter/Ctrl/Alt/Meta tidak pernah ditangkap; di tombol,
  Spasi dilepas tapi huruf tetap ditangkap; `code` kosong jatuh ke `event.key`.
- "Lihat bedanya" hanya di butir 4 dan 5, tanpa putar otomatis.
- Peta jari (`FingerCards`): kartu diturunkan dari `fingerMap.ts`, setiap tombol di tepat
  satu kartu (dijaga test).
- `/posture` satu-satunya rute `max-w-6xl` (`WIDE_ROUTES`). ≥ 1100 px dua kolom; peta
  *sticky* hanya kalau layar ≥ 46rem tingginya, dan **tidak pernah diberi gulir sendiri**.

Sebelumnya: **Fase 7 — kode selesai (2026-09-13). Fase 4 masih menyisakan dua
butir DoD yang menunggu tangan pemilik** (menyelesaikan sendiri Unit 1–3, dan menilai
apakah kriteria lulusnya adil), Fase 6 menambah satu (apakah heatmap latensi
menyorot tombol yang *terasa* lambat), dan Fase 7 satu lagi (apakah drill adaptif
*terasa* menyasar kelemahan); Fase 5–7 dikerjakan lebih dulu atas permintaan
pemilik, dan butir-butir itu **tidak hilang**.

Yang mengikat dari Fase 7 (ADR-034): skor tombol lemah **memakai `keyWeights`
generator**, bukan rumus kedua; sumbernya `keystats` kumulatif (sesi tidak menyimpan
statistik per tombol). Jangan mengganti pemilihan kata per tombol dengan
`generateWordDrill` — rata-rata bobot per kata membuat drill tidak terukur lebih berat
ke tombol lemah. `AdaptivePage` memuat wordlist lewat `import()`, dijaga `chunkgraph`.

Yang mengikat dari Fase 6: `/stats` hanya **membaca** `typing:sessions` dan
`typing:keystats` — tidak ada penyimpanan baru. Skala heatmap (ADR-033): error
absolut, latensi **relatif terhadap median pengguna**, pita dibulatkan ke bawah.
Chunk `StatsPage` dijaga `npm run chunkgraph` (`LAZY_ONLY`). Jangan "memperbaiki"
`attempts` kurang satu tanpa membaca catatan Fase 6 di backlog dok. 10 — perbaikan
naifnya merusak heatmap kelambatan.

Yang mengikat dari Fase 5: batas waktu `/practice` adalah **waktu aktif**, dan sesi
berbatas waktu **dinilai atas seluruh durasinya** — bukan sampai keystroke terakhir
(ADR-032). Membalikkannya mengembalikan bug 896 WPM. Sumber teksnya wajib tetap lewat
`import()` dinamis; `npm run chunkgraph` menjaganya.
 Bagian bersyarat Fase 4 (mode input strict/non-strict) sudah dikerjakan
lebih dulu karena uji pemula memutuskannya di Fase 3 (ADR-029).

Yang sudah lunas di Fase 4: konten 30 lesson + 6 review (nyata, 14.858 karakter
statis), validator kurikulum sebagai gerbang, dan **tes kelulusan kursus 40 WPM /
95%** yang sebelumnya hanya hidup di dokumen (ADR-030 — drill ber-`graduation: true`
di `u6-review`, dinilai terpisah dari kelulusan lesson dan tidak menggerbangi apa pun).

Dua butir DoD yang tersisa **tidak bisa dikerjakan agent**: menyelesaikan sendiri
Unit 1–3 dari nol, dan menilai apakah kriteria lulusnya terasa adil. Jangan
menyatakannya lulus dari test — mengetik 36 lesson di jsdom membuktikan kodenya
jalan, bukan kurikulumnya mengajar.

Fase 1 kodenya selesai. Utang verifikasi performanya **sebagian besar sudah lunas**
(2026-09-11):

| Utang Fase 1 | Status |
|---|---|
| Nol alokasi heap per keystroke | ✅ `npm run perf:heap` — otomatis, tiap commit |
| Nol re-render per keystroke | ✅ `rerender.test.tsx` — otomatis, tiap commit |
| 15 menit memakai sendiri | ✅ dijalankan; menemukan layout shift scrollbar, diperbaiki |
| `autotype()` | ✅ 2026-09-12 — p95 7,9 ms / p99 8,7 / nol long task |
| `watchRealInput()` | ✅ 2026-09-12 — maks 24 ms, lulus ambang ADR-022 |

**Lunas seluruhnya.** Dua yang pertama tidak lagi lewat DevTools (ADR-021).
Dua yang terakhir tetap manual dan memang **tidak bisa diotomasi**:
Event Timing menolak input non-manusia (ADR-020), dan panel browser otomasi tidak
pernah memanggil `requestAnimationFrame` — tanpa paint, tidak ada p95 input→paint.
Jangan mencoba mengotomasinya lagi lalu menyimpulkan lulus dari panel yang tidak
pernah menggambar.

**DoD Fase 2 terpenuhi seluruhnya (2026-09-12).** Sisa terakhir R-06 — `caretCheck()`
sesudah zoom browser — ikut lunas di hari yang sama: `selisihCaret` **0**,
`kolomTerjauhMeleset` **0**, `watchCLS()` **cls 0 / nol shift**, dan `resize` jendela
sungguhan membungkus ulang tanpa menghapus ketikan (ADR-028). Tidak ada lagi utang
pengukuran manual yang menggantung.

**Fase 3 — yang sudah ada dan jangan ditulis ulang:**

| Bagian | Di mana |
|---|---|
| unlock, assist ladder, pencatatan percobaan | `src/features/curriculum/progress.ts` (pure) |
| ambang placement + saran gugus lemah | `src/features/curriculum/placement.ts` (pure) |
| `Lesson` → teks target, drill mikro | `src/features/curriculum/drills.ts` |
| generator berbobot (dok. 04 §8) | `src/lib/engine/generator.ts` (pure) |
| gabungan hasil beberapa drill | `src/lib/engine/combine.ts` (ADR-024) |
| panggung sesi, dipakai lesson & placement | `src/features/typing/components/TypingStage.tsx` |

Dua hal yang lahir dari uji pemula dan gampang tergerus kalau tidak tahu asalnya:
`/posture` (ADR-027) isinya **bukan** panduan postur generik — dua butirnya menambal
kegagalan yang teramati, dan keyboardnya sengaja di atas teks. Mode input (ADR-029)
default **strict di `/learn`**, non-strict di `/practice`, bisa diganti pengguna dan
bertahan lewat `typing:settings`.

Satu aturan Fase 4 yang mudah dirusak tanpa sadar: **`u6-review` dinilai dua kali**
(ADR-030). Drill ber-`graduation: true` **tidak** ikut menilai kelulusan lesson, dan
ambang 40/95-nya tidak pernah diturunkan assist ladder. Pembagiannya dikerjakan
`gradeAttempt()` yang pure; jangan memindahkannya ke komponen.

Tiga aturan Fase 3 yang mengikat dan mudah dirusak tanpa sadar:
1. **Satu lesson = beberapa sesi engine, dinilai sebagai gabungan** (ADR-024). Jangan
   menilai drill terakhir saja, dan jangan menyambung semua drill jadi satu target.
2. **Yang dihitung sebagai percobaan** (ADR-025): sesi yang di-void **tidak**, drill
   mikro **tidak**, dan gagal sesudah pernah lulus **tidak** mencabut kelulusan.
   Tingkat bantuan di layar hasil selalu dibekukan ke percobaan yang baru selesai —
   `attempt` yang sedang berjalan sudah bergeser satu.
3. **Halaman sesi tidak boleh mengimpor `data/curriculum/en/index.ts`** — itu menarik
   ketujuh unit. Pakai `loadLesson()`.

Tiga pelajaran Fase 2 yang mengikat fase berikutnya (rinciannya di catatan penutup
dok. 08):
1. **Tiap gerbang performa wajib diuji dengan kontrol negatif.** Gerbang yang belum
   pernah merah belum terbukti menjaga apa pun. Alat ukur di fase ini tiga kali
   salah, dan tiap kali angkanya terlihat masuk akal.
2. **Penalaran tentang spec tidak menggantikan pengukuran.**
3. **Curigai "ruang yang tidak dipesan sejak paint pertama".** Ketiga layout shift
   yang ditemukan berbentuk itu, dan nol di antaranya tertangkap 156 test.

**Jangan mulai fase berikutnya sebelum DoD fase berjalan terpenuhi** (dok. 08).
Jangan mengerjakan fitur dari fase yang jauh di depan hanya karena "sekalian".

## 3. Batasan arsitektur — mengikat, sebagian ditegakkan ESLint

1. `src/lib/engine/` **tidak boleh mengimpor React** atau menyentuh DOM. Harus bisa
   dites di Node murni. _(ditegakkan `no-restricted-imports`)_
2. Komponen **tidak boleh menyentuh `localStorage`** — semua lewat `src/lib/storage/`.
   _(ditegakkan `no-restricted-globals`)_
3. Teks latihan **tidak di-hardcode di komponen** — semuanya di `src/data/`.
4. **Tidak ada `fetch`** saat runtime. Semua aset dibundel. _(ditegakkan lint)_
5. Aliran data satu arah: `data → engine → store → komponen`.
6. Manipulasi DOM langsung **hanya** di `TypingArea` (dok. 06 §2 poin 6), dan wajib
   diberi komentar agar tidak "dirapikan" jadi React idiomatic.
7. **Tidak ada `getBoundingClientRect()` di jalur input.**

Dua batasan performa yang tidak boleh dilanggar diam-diam (dok. 08 Fase 1 DoD):
**nol alokasi heap per keystroke** dan **nol re-render React per keystroke**.

## 4. Kurikulum adalah data, dan divalidasi mesin

Kurikulum sudah ditulis penuh di `src/data/curriculum/en/` (1 placement + 30 lesson +
6 review). **Jangan menulis ulang, jangan menambah lesson tanpa alasan tercatat.**

Aturan paling keras: **tidak ada drill yang boleh memuat karakter yang tombolnya belum
diperkenalkan**. Sekali dilanggar, seluruh janji kurikulum berjenjang batal.

Setelah menyentuh apa pun di `src/data/`, jalankan:

```bash
npm run validate:curriculum
```

## 5. Gerbang sebelum menyatakan selesai

```bash
npm run verify
```

Itu menjalankan lint → test (termasuk validator kurikulum) → build (`tsc -b` strict) →
anggaran bundel → **graf chunk** (ADR-031: layar sesi tidak boleh menarik peta kurikulum
lengkap — aturan yang benar di sumber tapi batal di keluaran bundler selama tiga fase). Anggarannya dipecah dua (ADR-018):

| Anggaran      | Batas       | Artinya                                                            |
| ------------- | ----------- | ------------------------------------------------------------------ |
| framework     | 85 KB gzip  | **terkunci** — menambah/mengganti dependensi runtime wajib ADR     |
| kode aplikasi | 20 KB gzip  | ini yang menggigit tiap hari; kalau jebol, pindahkan ke chunk lazy |
| bundel awal   | 90 KB gzip  | atap keduanya + CSS (ADR-035, turun dari 105)                      |
| total         | 250 KB gzip | seluruh chunk                                                      |

Kalau ada kode yang tidak dibutuhkan sebelum keystroke pertama, ia **tidak boleh** ada
di bundel awal — pakai `lazy()` / dynamic import, bukan menaikkan angka.

## 6. Kalau rencananya ternyata salah

Itu diizinkan — tapi urutannya mengikat (dok. 00 "Cara memakai dokumen ini"):

1. **Ubah dokumennya.**
2. **Catat alasannya sebagai ADR di `docs/planning/10-decisions.md`.**
3. Baru ubah kodenya.

Jangan pernah mengubah kode menjadi tidak sesuai dokumen tanpa mengubah dokumennya —
dokumen yang tidak diupdate lebih berbahaya daripada tidak ada dokumen.

## 7. Ide fitur baru tidak dikerjakan langsung

Tulis di `docs/planning/10-decisions.md` bagian **"Backlog ide"**, lalu lanjutkan fase
yang sedang berjalan. Ini aturan yang paling sering dilanggar dan paling sering
membunuh proyek pribadi.
