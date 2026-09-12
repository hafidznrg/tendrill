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

Status sekarang: **Fase 3 SELESAI (2026-09-12), seluruh DoD terpenuhi. Berikutnya
Fase 4 — kurikulum Unit 2–6 + review session.** Bagian bersyarat Fase 4 (mode input
strict/non-strict) sudah ikut dikerjakan lebih dulu karena uji pemula memutuskannya
di Fase 3 (ADR-029).

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
anggaran bundel. Anggarannya dipecah dua (ADR-018):

| Anggaran      | Batas       | Artinya                                                            |
| ------------- | ----------- | ------------------------------------------------------------------ |
| framework     | 85 KB gzip  | **terkunci** — menambah/mengganti dependensi runtime wajib ADR     |
| kode aplikasi | 20 KB gzip  | ini yang menggigit tiap hari; kalau jebol, pindahkan ke chunk lazy |
| bundel awal   | 105 KB gzip | atap keduanya + CSS                                                |
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
