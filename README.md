# tendrill

Belajar mengetik sepuluh jari — bertahap, tanpa backend, tanpa akun.
Semua progres tinggal di `localStorage` browser.

Perencanaan lengkap ada di [`docs/planning/`](docs/planning/00-README.md).
Aturan kerja (termasuk untuk agent) ada di [`CLAUDE.md`](CLAUDE.md).

**Status: Fase 0 (fondasi) selesai. Berikutnya Fase 1 — typing engine + storage.**

## Perintah

```bash
npm run dev                  # dev server
npm run verify               # lint → test → build (strict) → anggaran bundel
npm run validate:curriculum  # aturan kumulatif kurikulum (dok. 04 §5)
npm run budget               # anggaran bundel saja (butuh dist/, jalankan build dulu)
```

`npm run verify` adalah gerbang yang sama dengan CI. Kalau ia hijau, PR-nya hijau.

## Anggaran yang ditegakkan mesin

| Batas              | Nilai                                        | Ditegakkan oleh                  |
| ------------------ | -------------------------------------------- | -------------------------------- |
| Bundel awal        | < 90 KB gzip                                 | `scripts/check-bundle-budget.ts` |
| Total semua chunk  | < 250 KB gzip                                | idem                             |
| Karakter kurikulum | tidak boleh mendahului tombol yang diajarkan | `scripts/validate-curriculum.ts` |
| Engine tanpa React | `src/lib/engine/` murni                      | ESLint `no-restricted-imports`   |
| `localStorage`     | hanya di `src/lib/storage/`                  | ESLint `no-restricted-globals`   |

## Stack

React 19 · Vite · TypeScript strict · Tailwind 4 · React Router (deklaratif, ADR-017) ·
Zustand · Vitest. Font di-host sendiri; tidak ada network request saat runtime.
