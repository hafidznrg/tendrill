# Planning — **tendrill**

Kumpulan dokumen perencanaan sebelum baris kode pertama ditulis.
Dibaca berurutan dari atas ke bawah.

| # | Dokumen | Isi | Status |
|---|---------|-----|--------|
| 01 | [prd.md](01-prd.md) | Product Requirements — masalah, user, scope, fitur, metrik sukses | **v2** |
| 02 | [user-flows.md](02-user-flows.md) | Alur pengguna & struktur halaman | **v2** |
| 03 | [typing-engine-spec.md](03-typing-engine-spec.md) | Spesifikasi teknis inti: input handling, WPM, akurasi | **v2** |
| 04 | [curriculum-spec.md](04-curriculum-spec.md) | Struktur kurikulum, level, kriteria kelulusan, generator drill | **v3** — kurikulum sudah ditulis, lihat `src/data/curriculum/` |
| 05 | [data-model.md](05-data-model.md) | Skema localStorage, versioning, migrasi | **v2** |
| 06 | [architecture.md](06-architecture.md) | Stack, struktur folder, batasan arsitektur | **v2** |
| 07 | [ux-ui-spec.md](07-ux-ui-spec.md) | Prinsip desain, layout, tema, aksesibilitas | **v2** |
| 08 | [roadmap.md](08-roadmap.md) | Fase pengerjaan, definition of done per fase | **v2** |
| 09 | [testing-plan.md](09-testing-plan.md) | Strategi test, kasus uji kritikal | **v2** |
| 10 | [decisions.md](10-decisions.md) | Catatan keputusan arsitektur (ADR log) | Hidup |
| 11 | [plan-review.md](11-plan-review.md) | **Peninjauan ulang rencana** — kritik + perbaikan (R-01…R-24) | Diterapkan |
| 12 | [brand-identity.md](12-brand-identity.md) | Nama, logo, wordmark, tipografi, nilai token warna | **v1** — aset di `src/assets/brand/` |

## Keputusan kunci (ringkasan)

- **Nama produk: tendrill** (huruf kecil) — *ten* jari + *tendril* (sulur) + *drill*.
  Deploy di subdomain situs pribadi, bukan domain sendiri (ADR-015).
- **Tanpa backend, tanpa auth.** Semua data di `localStorage`.
- **Konten bahasa Inggris dulu**, arsitektur konten disiapkan multi-bahasa untuk ID menyusul.
- **Desktop-first.** Mobile tidak didukung untuk latihan (10 jari butuh keyboard fisik).
- **Layout QWERTY** dulu; abstraksi layout disiapkan sejak awal.
- **Engine bermutasi, bukan immutable** — nol alokasi per keystroke (ADR-007).
- **Teks sesi diperbarui di luar React** — nol re-render per keystroke (ADR-008).
- **Placement test + assist ladder** — dua persona prioritas punya pintu masuk dan
  jalan keluar (ADR-010).
- **Diagnosis memakai latensi, bukan hanya kesalahan** (ADR-011).
- **Uji pengguna nyata di ~hari 11**, bukan hari 25 (ADR-012).
- **`--caret` kuning hanya untuk caret** — satu-satunya warna panas di antarmuka (ADR-016).

## Status revisi

Dok. 12 ditambahkan pada 2026-09-11: proyek punya nama (**tendrill**), dan token warna
yang selama ini hanya bernama di dok. 07 §5 akhirnya punya nilai. Nilai token sekarang
tinggal di dok. 12 §5 dan `src/assets/brand/tokens.css`; kalau dok. 07 dan dok. 12
berbeda, dok. 12 menang. Alasannya di ADR-015 dan ADR-016.

Dok. 04 naik ke **v3** pada 2026-09-10: kurikulumnya benar-benar ditulis
(`src/data/curriculum/en/`, 1 placement + 30 lesson + 6 review) dan proses menulisnya
membongkar enam hal yang salah di v2 — terutama kriteria lulus yang harus per-lesson,
bukan per-unit (ADR-013), dan `newKeys` yang ternyata berisi karakter, bukan tombol
fisik (ADR-014). Rinciannya di dok. 04 §15. Aturan kumulatifnya ditegakkan mesin:
`node --experimental-strip-types scripts/validate-curriculum.ts`.

Dok. 03–10 sudah direvisi ke v2 pada 2026-09-10 setelah peninjauan menyeluruh.
Alasan tiap perubahan ada di [11-plan-review.md](11-plan-review.md), bernomor `R-01`…`R-24`.
Kalau nanti bertanya "kenapa dok. 03 tidak immutable?", jawabannya ada di sana.

## Cara memakai dokumen ini

Dokumen ini adalah kontrak dengan diri sendiri, bukan birokrasi.
Kalau saat implementasi ada yang terbukti salah, **ubah dokumennya**, catat alasannya di `10-decisions.md`, lalu lanjut. Dokumen yang tidak diupdate lebih berbahaya daripada tidak ada dokumen.
