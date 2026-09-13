# 06 — Technical Architecture

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

> **Catatan revisi v2.** Recharts dihapus (R-10), shadcn ditunda (R-13), ditambahkan peta
> code-splitting dan anggaran bundel yang bisa diverifikasi (R-11), skrip build wordlist
> (R-12), serta lapisan teks imperatif (R-08).

## 1. Stack

| Lapisan      | Pilihan                             | Alasan                                                                                                                                                                                       |
| ------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | **React 19 + Vite + TypeScript**    | Tanpa backend, tidak butuh SSR. Vite = dev server tercepat, build = static files                                                                                                             |
| Routing      | **React Router**                    | Cukup untuk 6 halaman client-side                                                                                                                                                            |
| Styling      | **Tailwind CSS**                    | Iterasi cepat, konsisten, bundle kecil setelah purge                                                                                                                                         |
| Komponen UI  | **Tidak ada di awal** (R-13)        | 6 halaman ini butuh ~1 dialog dan 2 select; shadcn menarik Radix tanpa imbalan sepadan. Salin satu komponen shadcn _saat_ dialog aksesibel benar-benar dibutuhkan                            |
| State global | **Zustand**                         | Ringan, di luar React tree, tidak memaksa re-render tak perlu                                                                                                                                |
| Grafik       | **SVG tulis tangan** (R-10)         | Recharts ≈ 90–110 KB gzip untuk dua grafik di halaman yang jarang dibuka — anggaran bundel jebol sebelum kode aplikasi ditulis. `<polyline>` + `<rect>` ≈ 80 baris dan sepenuhnya terkendali |
| Test         | **Vitest** + **Testing Library**    | Cepat, satu konfigurasi dengan Vite                                                                                                                                                          |
| Hosting      | **Vercel / Netlify / GitHub Pages** | Static site, gratis                                                                                                                                                                          |

### Kenapa Vite, bukan Next.js

Tidak ada server, tidak ada SEO yang kritikal, tidak ada API route. Next.js hanya menambah lapisan konsep (App Router, server components, hydration) yang tidak memberi manfaat di sini — dan hydration justru menambah kompleksitas untuk aplikasi yang sangat sensitif terhadap input latency. Jika suatu saat butuh backend, migrasi ke Next.js tetap mungkin.

_(Keputusan ini dicatat sebagai ADR-001 di dok. 10.)_

## 2. Batasan arsitektur (mengikat)

1. **Engine tidak mengenal React.** `src/lib/engine/` tidak boleh mengimpor apa pun dari `react`. Bisa dites di Node murni.
2. **Komponen tidak menyentuh localStorage.** Semua lewat `src/lib/storage/`.
3. **Konten tidak di-hardcode di komponen.** Semua teks latihan ada di `src/data/`.
4. **Tidak ada network request saat runtime.** Semua aset dibundel.
5. **Satu arah aliran data:** `data → engine → store → komponen`. Komponen tidak pernah
   memodifikasi objek sesi secara langsung.
6. **Lapisan teks sesi tidak dikelola React setelah mount** (R-08). `TypingArea` memasang
   span sekali, lalu memperbarui `className` secara imperatif dari `outcome.dirty`.
   Ini satu-satunya tempat manipulasi DOM langsung diizinkan, dan wajib diberi komentar
   penjelas supaya tidak "dirapikan" menjadi React idiomatic di kemudian hari.
7. **Tidak ada `getBoundingClientRect()` di jalur input.** Posisi caret dihitung aritmetika
   dari `charWidth` × `lineHeight` (dok. 03 §8).

## 3. Struktur folder

```
src/
├── app/
│   ├── router.tsx
│   └── layout/
│
├── pages/
│   ├── HomePage.tsx
│   ├── LearnPage.tsx
│   ├── LessonPage.tsx
│   ├── PlacementPage.tsx
│   ├── PracticePage.tsx
│   ├── StatsPage.tsx
│   └── SettingsPage.tsx
│
├── features/
│   ├── typing/                 # inti produk
│   │   ├── components/
│   │   │   ├── TypingArea.tsx
│   │   │   ├── CharCell.tsx        # memo, props primitif
│   │   │   ├── Caret.tsx
│   │   │   ├── LiveMetrics.tsx
│   │   │   ├── ResultScreen.tsx
│   │   │   └── TypingStage.tsx      # panggung sesi, dipakai lesson & placement
│   │   ├── hooks/
│   │   │   ├── useTypingSession.ts # jembatan engine ↔ React
│   │   │   └── useKeyboardCapture.ts
│   │   └── index.ts
│   │
│   ├── keyboard/               # virtual keyboard + panduan jari
│   │   ├── components/VirtualKeyboard.tsx
│   │   └── fingerMap.ts
│   │
│   ├── curriculum/                 # PURE kecuali useProgress.ts
│   │   ├── components/UnitList.tsx
│   │   ├── progress.ts             # unlock, assist ladder, pencatatan percobaan
│   │   ├── placement.ts            # ambang penempatan (dok. 04 §3)
│   │   ├── drills.ts               # Lesson → teks target (static + generator)
│   │   ├── loadLesson.ts           # pemuat per-unit, bukan seluruh kurikulum
│   │   └── useProgress.ts          # satu-satunya yang menyentuh storage
│   │
│   └── stats/
│       ├── stats.ts                     # PURE: geometri grafik, skala heatmap (ADR-033)
│       ├── load.ts                      # satu-satunya yang menyentuh storage
│       ├── components/HeatmapKeyboard.tsx # dasar bersama kedua heatmap
│       ├── components/PracticeGrid.tsx  # grid 30 hari (dok. 07 §10)
│       ├── components/WpmChart.tsx      # SVG tulis tangan, tanpa library
│       ├── components/KeyHeatmap.tsx    # heatmap error
│       └── components/LatencyHeatmap.tsx # heatmap latensi (R-18)
│
├── lib/
│   ├── engine/                 # PURE — tanpa React, tanpa DOM
│   │   ├── session.ts          # createSession, applyKey, backspace, pause/resume
│   │   ├── log.ts              # buffer kolumnar typed-array (R-03)
│   │   ├── accumulators.ts     # Welford, metrik live O(1) (R-02)
│   │   ├── metrics.ts          # computeResult (O(n), sekali per sesi)
│   │   ├── wrap.ts             # wrapText() (R-07)
│   │   ├── combine.ts          # gabungan hasil beberapa drill (ADR-024)
│   │   ├── generator.ts        # drill berbobot (dok. 04 §8)
│   │   └── types.ts
│   ├── storage/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── migrations.ts
│   └── utils/
│
├── data/
│   ├── curriculum/en/
│   ├── wordlists/en/
│   └── quotes/en/
│
└── store/
    ├── settingsStore.ts
    └── progressStore.ts

scripts/
└── build-wordlists.ts          # filter 10k kata → file per unit (R-12)
```

## 4. Jembatan engine ↔ React

Satu-satunya tempat yang menghubungkan dunia murni dan dunia React: `useTypingSession`.

```ts
function useTypingSession(target: string) {
  const sessionRef = useRef(createSession(target, cols)); // sumber kebenaran
  const spansRef = useRef<HTMLSpanElement[]>([]); // lapisan teks (R-08)
  const [structuralTick, setStructuralTick] = useState(0); // HANYA untuk ganti target/restart
  const [metrics, setMetrics] = useState(EMPTY); // diupdate tiap 250ms

  // keydown → applyKey → KeyOutcome
  //   → for (i of outcome.dirty) spansRef.current[i].className = CLASS[state]
  //   → caret.style.transform = translate(col*charWidth, row*lineHeight)
  //   → TIDAK ada setState di jalur ini
  // rAF bergerbang 250ms, hanya saat status==='running' → computeLiveMetrics (O(1)) → setMetrics
  // finished → computeResult → requestIdleCallback → storage layer
}
```

Yang **tidak boleh** dilakukan di sini:

- Menaruh `SessionState` di `useState` — setiap keystroke akan menyalin seluruh array karakter.
- Menaruh objek sesi di context.
- Memanggil `setState` apa pun di jalur keystroke. Jalur itu harus nol pekerjaan React (R-08).
- `setInterval` untuk metrik — pakai rAF bergerbang supaya berhenti sendiri saat tab tersembunyi (R-09).

## 5. Perkakas

```
TypeScript strict: true
ESLint + Prettier
Vitest untuk unit test
Husky pre-commit: typecheck + lint + test (opsional, tambahkan bila terasa perlu)
```

Tidak memakai state management library selain Zustand, tidak memakai form library, tidak memakai animation library di v1.

## 6. Code splitting & anggaran build (R-11)

Prinsip produk #1 adalah "keystroke pertama < 3 detik", tapi v1 membundel kurikulum,
wordlist, dan halaman statistik ke dalam satu bundel awal. Peta pemuatan sekarang mengikat:

| Chunk       | Isi                                     | Kapan dimuat                  |
| ----------- | --------------------------------------- | ----------------------------- |
| `main`      | React, router, tema, engine, layar sesi | awal                          |
| `unit-1`    | data lesson Unit 0–1                    | awal (prefetch)               |
| `unit-n`    | data lesson unit lain                   | saat unit dibuka              |
| `curriculum-units` | 7 objek unit + tipe (`units.ts`) — tanpa isi drill | bersama layar sesi; ia yang dipakai `loadLesson.ts` |
| `curriculum-map` | peta lengkap 37 lesson (`data/curriculum/en/index.ts`) | saat `/learn` dibuka; **tidak pernah** dari layar sesi |
| `wordlists` | daftar kata & kutipan                   | saat `/practice` atau Unit 4+ |
| `stats`     | halaman statistik + chart SVG           | saat `/stats`                 |
| `settings`  | halaman pengaturan                      | saat `/settings`              |

### Anggaran

Anggaran dipecah dua (ADR-018). Angka tunggal "bundel awal" ternyata 96% berisi
dependensi pihak ketiga, jadi ia tidak pernah bisa menangkap kode kita sendiri
membengkak — ia hanya meledak sekali saat dependensi bertambah, lalu dinaikkan.

- **Framework ≤ 85 KB gzip** — React, react-dom, router, zustand. Terkunci:
  menambah atau mengganti dependensi runtime **wajib ADR**, bukan keputusan bebas.
- **Kode aplikasi ≤ 20 KB gzip** di bundel awal — ini yang digigit tiap hari, dan
  ini satu-satunya angka yang benar-benar kita kendalikan. Proyeksi sampai Fase 8:
  engine ~6 + layar sesi ~4 + virtual keyboard ~3 + layout/store ~2 ≈ 15 KB.
- **Bundel awal < 105 KB gzip** (jumlah keduanya, plus CSS).
- Total seluruh chunk < 250 KB gzip.

**"Tidak pernah dari layar sesi" ditegakkan mesin** (ADR-031). `units.ts` wajib
berada di chunk yang **terpisah** dari `index.ts`: keduanya di folder yang sama,
sehingga satu aturan `manualChunks` yang menyapu folder itu akan menggabungkan
mereka — dan layar sesi ikut menarik ketujuh unit tanpa satu baris impor pun
berubah. Persis itu yang terjadi sejak Fase 3 dan tidak tertangkap anggaran, yang
memang hanya mengukur bundel **awal**. `npm run chunkgraph` menelusuri impor
statis dari chunk tiap halaman sesi dan menolak `curriculum-map`, `unit-N`, serta
`wordlists`; ia bagian dari `npm run verify`.

> **Pembaruan Fase 8 (ADR-035): atap bundel awal diturunkan ke 90 KB** (terukur 88,9 KB).
> Pengukuran Fast 3G di bawah tetap manual dan belum dijalankan.
>
> **Angka 105 belum diukur, dan itu utang.** Ia dinaikkan dari 90 karena kepentok
> (ADR-018), bukan karena diturunkan dari pengukuran. Utangnya dibayar di Fase 8:
> ukur waktu ke keystroke pertama di Fast 3G ter-throttle, lalu **turunkan** angka
> ini ke hasil pengukuran. Sampai itu terjadi, 105 adalah tebakan yang jujur
> mengaku sebagai tebakan.

- Lighthouse Performance ≥ 95 di desktop.
- **Waktu ke keystroke pertama** diukur dengan `performance.mark` dari navigasi sampai
  `TypingArea` interaktif, pada jaringan Fast 3G ter-throttle: **< 3 detik** (R-24).
- Berfungsi penuh secara offline setelah kunjungan pertama (PWA opsional di P2).

CI wajib menggagalkan build jika anggaran bundel terlampaui — batas yang tidak ditegakkan
otomatis akan dilanggar dalam dua minggu.

## 6b. Deployment

Seluruh routing terjadi di sisi klien (dok. 02 §1), jadi host statis **wajib**
mengembalikan `index.html` untuk path apa pun yang tidak cocok dengan berkas nyata.
Tanpa itu hanya `/` yang hidup: setiap deep link dan setiap refresh di `/learn`,
`/stats`, atau `/settings` berakhir 404 — dan pengguna yang menyimpan bookmark ke
lesson-nya kehilangan jalan masuk.

Di Vercel aturan itu tinggal di `vercel.json` (`rewrites` → `/index.html`). Berkas
statis dilayani lebih dulu, jadi aturan tangkap-semua ini tidak pernah menelan
`/assets/*`.

Ditemukan saat verifikasi deploy pertama pada 2026-09-11: `/` hidup, `/learn/u1-l1`
404. Kalau host-nya suatu saat pindah, ini hal pertama yang harus diperiksa ulang.

## 7. Penanganan kegagalan

Satu `ErrorBoundary` di level rute (R-24), dengan tombol "muat ulang tampilan" yang
**tidak menghapus data pengguna**. Kesalahan render di `/stats` tidak boleh membuat
halaman sesi ikut mati.
