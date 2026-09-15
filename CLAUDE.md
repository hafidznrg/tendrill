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

Status sekarang: **Fase 8 — kode selesai (2026-09-13), DoD menunggu pemilik**: uji
pakai ≥ 3 orang, Lighthouse, ulang `autotype()`/`watchRealInput()`, dan deploy.
Yang mengikat dari Fase 8 (ADR-035): suara ketik **lazy dan mati default** (satu-satunya
alokasi per keystroke yang disengaja), `DesktopOnly` diputuskan **sekali saat mount**
(bukan `resize` — ADR-028), tema dicerminkan ke ekspor di `exportAll` (bukan di toggle —
itu menarik storage ke bundel awal), dan atap bundel awal **90 KB**.

**Siluet tangan (ADR-036, 2026-09-14)** — naik dari backlog atas permintaan pemilik.
Geometrinya diturunkan dari posisi tombol yang diukur (`hands.ts`, pure), bukan gambar
statis; pengukuran hanya saat mount/`ResizeObserver`, jalur keystroke hanya menulis
atribut dengan string yang sudah dihitung. Selalu di `/learn/:id` dan `/posture`,
opsional di `/practice` (`showHandsInPractice`, default mati), tidak pernah di
`/placement`. Satu butir DoD menunggu pemilik: **apakah siluet membantu pemula
menaruh tangan, dan apakah bentuknya pas di atas tombol di layar sungguhan.**

**Siluet hibrida (ADR-037, 2026-09-15)** menggantikan *bentuk* prosedural ADR-036, bukan
*letaknya*: pose per tombol dari `finger-svg-tendrill/` dibangkitkan ke
`src/data/hands/poses.ts` oleh `scripts/build-hand-poses.ts` (**jangan disunting
tangan** — ubah SVG-nya lalu jalankan ulang generator). Pose disimpan di ruang keyboard;
`hands.ts` mem-fit affine ke tombol terukur. Ujung jari aktif setiap pose wajib di dalam
tombolnya — digerbangi generator dan `hands.test.ts` (dengan kontrol negatif). Data pose
~28 KB **hanya lewat `loadHandPoses()`**, dijaga `chunkgraph` (`LAZY_ONLY`).

**`/posture` dapat dijelajah (ADR-038, 2026-09-15)**: keyboard fisik + hover lewat hook
`useKeyExplorer` — **hanya `/posture` yang memasangnya**, jangan dijadikan mode di
`VirtualKeyboard` (layar sesi tidak boleh mendapat listener baru). Tab/Enter/Ctrl/Alt/Meta
tidak pernah ditangkap; di tombol, Spasi dilepas tapi huruf tetap ditangkap. "Lihat
bedanya" hanya di butir 4 dan 5, tanpa putar otomatis. Butir DoD pemilik: apakah
menjelajah membantu pemula, atau mengalihkan dari "raba, jangan lihat".

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
