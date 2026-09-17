# 05 — Data Model (localStorage)

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

Tidak ada backend. Seluruh state persisten hidup di `localStorage` browser pengguna.

> **Catatan revisi v2.** Ditambahkan: latensi per tombol (R-18), rolling buffer diturunkan
> 500→200 + penulisan saat idle (R-20), tangga pemangkasan kuota (R-21), rekonsiliasi
> terhadap drift kurikulum (R-22), field placement & assist (R-14/R-15).

---

## 1. Prinsip

1. **Satu namespace, beberapa key.** Prefiks `typing:` untuk semua key, agar tidak bentrok dan mudah dibersihkan.
2. **Setiap key punya `version`.** Migrasi wajib dipikirkan sejak awal; data pengguna tidak boleh rusak saat app di-update.
3. **Simpan hasil, bukan proses.** Jangan pernah menyimpan log keystroke mentah — itu membengkakkan storage tanpa manfaat.
4. **Tulis hanya saat sesi selesai, dan saat browser sedang senggang.** Tidak ada
   penulisan selama mengetik. Penulisan dijadwalkan dengan `requestIdleCallback`
   **setelah layar hasil ter-paint** (R-20), dengan flush paksa pada
   `visibilitychange → hidden` supaya tidak ada data yang hilang.
5. **Setiap pembacaan harus defensif.** Data bisa rusak, dimodifikasi manual, atau berasal dari versi lama. Baca gagal ⇒ kembali ke default, jangan crash.

## 2. Key

| Key | Isi | Perkiraan ukuran |
|---|---|---|
| `typing:progress` | Status kurikulum per lesson | ~5 KB |
| `typing:sessions` | Riwayat hasil sesi (rolling, maks **200**) | ~60 KB |
| `typing:keystats` | Statistik agregat per tombol (error **& latensi**) | ~8 KB |
| `typing:settings` | Preferensi pengguna | < 1 KB |
| `typing:meta` | Versi skema, streak, timestamp | < 1 KB |

Total target setelah pemakaian setahun: **< 300 KB** (kuota browser ~5 MB).

Batas sesi diturunkan dari 500 ke 200 (R-20): agregat `daily` sudah menopang grafik jangka
panjang, sementara menulis ulang ~150 KB JSON di akhir tiap sesi adalah biaya nyata pada
momen yang justru ingin terasa ringan.

## 3. Skema

### `typing:progress`
```ts
{
  version: 1,
  lessons: {
    "u1-l1": {
      status: "passed" | "passed-with-assist" | "passed-by-placement"
            | "attempted" | "locked",
      attempts: number,             // penggerak assist ladder (dok. 04 §9)
      bestWpm: number,
      bestAccuracy: number,
      firstPassedAt: number | null, // epoch ms
      lastAttemptAt: number
    }
  },
  placement: {                      // R-14, null jika placement dilewati
    takenAt: number,
    netWpm: number,
    accuracy: number,
    unlockedThrough: string | null  // unitId terakhir yang dibuka otomatis
  } | null
}
```
Lesson yang tidak ada di objek ini dianggap `locked`. Aturan unlock dihitung di runtime
(lesson N terbuka jika lesson N-1 berstatus salah satu varian `passed*`), **tidak disimpan** —
supaya perubahan kurikulum tidak membuat data lama tidak konsisten.

### Rekonsiliasi terhadap drift kurikulum (R-22)

Kurikulum pasti berubah, dan `progress.lessons` bisa memuat id yang sudah tidak ada.
v1 hanya membahas migrasi versi skema, bukan drift konten. Karena itu setiap pembacaan
yang menggabungkan progres dengan kurikulum wajib melewati:

```ts
reconcileProgress(progress, curriculum): ReconciledProgress
```

Id yang tak dikenal **tetap disimpan** (bisa jadi lesson-nya kembali di versi berikutnya)
tetapi **diabaikan** saat menghitung unlock, streak, dan statistik. Hal yang sama berlaku
untuk `sessions[].lessonId` yang menggantung.

### `typing:sessions`
```ts
{
  version: 1,
  items: Array<{
    id: string;              // uuid
    at: number;              // epoch ms
    source: "lesson" | "practice";
    lessonId?: string;
    mode?: "15s" | "30s" | "60s" | "full" | "adaptive"; // adaptive: Fase 7, ADR-034
    durationMs: number;
    netWpm: number;
    grossWpm: number;
    accuracy: number;
    consistency: number;
    totalKeystrokes: number;
    correctKeystrokes: number;
  }>
}
```
**Rolling buffer:** simpan maksimal **200** entri terbaru. Saat melebihi, buang yang tertua.
*(Baris ini sempat tertinggal menulis 500 saat revisi v2 — R-20 menurunkannya ke 200,
lihat §2. Diperbaiki 2026-09-11.)*
Grafik jangka panjang tetap akurat karena agregat harian juga disimpan (lihat di bawah).

### `typing:keystats`
```ts
{
  version: 1,
  keys: {
    // totalMs & slowCount ditambahkan di v2 (R-18): pengguna menengah
    // umumnya tidak banyak salah, melainkan lambat di tombol tertentu.
    "e": { attempts: 1240, errors: 63, totalMs: 186000, slowCount: 41 },
    "y": { attempts: 310,  errors: 47, totalMs: 74400,  slowCount: 88 }
  },
  bigrams: {                 // P1 — 50 transisi paling lambat saja
    "th": { sumMs: 12400, count: 210 }
  },
  confusions: {
    "e>r": 21,     // "expected>actual"
    "t>y": 14
  },
  daily: {
    "2026-09-10": { sessions: 4, ms: 620000, avgWpm: 38.2, avgAccuracy: 94.1 }
  }
}
```
`daily` disimpan maksimal 365 hari terakhir. Ini yang menopang grafik jangka panjang meski `sessions` sudah di-rolling.
`confusions` dipangkas menjadi 50 pasangan teratas setiap kali disimpan.
`bigrams` dipangkas menjadi 50 pasangan paling lambat (dengan `count` minimal 20 supaya
tidak bias data kecil).

Latensi rata-rata per tombol = `totalMs / attempts`. Angka ini menopang dua hal:
heatmap kedua di `/stats` ("lambat" berbeda dari "salah") dan `latencyMultiplier` di
generator adaptif (dok. 04 §8).

### `typing:settings`
```ts
{
  version: 1,
  theme: "system" | "light" | "dark",
  soundEnabled: boolean,
  showKeyboard: boolean,          // ADR-045: false → keyboard & siluet disembunyikan di layar sesi
  showFingerGuide: boolean,
  keyboardLayout: "qwerty",
  contentLanguage: "en",
  // ADR-029 — mode input per halaman. Opsional & aditif, jadi tanpa migrasi:
  // data lama yang tidak memilikinya jatuh ke default di bawah.
  inputMode?: {
    learn: "strict" | "non-strict",      // default "strict"
    practice: "strict" | "non-strict"    // default "non-strict"
  },
  // ADR-036 — siluet tangan di /practice & /practice/adaptive. Opsional & aditif,
  // tanpa migrasi; tidak ada = false. /learn selalu menampilkannya, jadi tidak disimpan.
  showHandsInPractice?: boolean,
  // ADR-044/045 — mode fokus. Nilai AKTIF hidup di key `tendrill.focus` (seperti
  // tema); field ini hanya cermin saat ekspor/impor.
  focusMode?: boolean
}
```

`inputMode` disimpan **per halaman, bukan per lesson** (ADR-029): pengguna yang memilih
non-strict di satu lesson memilihnya untuk cara ia belajar, bukan untuk satu drill.

### `typing:meta`
```ts
{
  version: 1,
  schemaVersion: 1,
  createdAt: number,
  lastActiveDate: string,   // "2026-09-10"
  streakDays: number,
  longestStreak: number,
  postureSeenAt?: number,   // ADR-027 — panduan postur sudah pernah tampil
  graduatedAt?: number      // ADR-030 — tes kelulusan 40 WPM / 95% pertama kali lulus
}
```

`graduatedAt` opsional & aditif, jadi **tanpa migrasi** — sama seperti `postureSeenAt`.
Ditulis **sekali** saat tes kelulusan (dok. 04 §4a) pertama kali lulus dan tidak pernah
dicabut: gagal lagi di percobaan berikutnya bukan alasan menghapus hari itu.

Ia sengaja di `meta`, bukan di `progress.lessons['u6-review']`: kelulusan kursus adalah
fakta tentang **pengguna**, bukan status sebuah lesson — `u6-review` bisa lulus tanpa
kelulusan kursus, dan sebaliknya.

## 4. Lapisan akses penyimpanan

Semua akses lewat satu modul (`src/lib/storage/`). **Dilarang** memanggil `localStorage` langsung dari komponen.

```ts
read<T>(key: StorageKey, fallback: T): T   // try/catch + validasi + migrasi
write<T>(key: StorageKey, value: T): void  // try/catch, tangani QuotaExceededError
clearAll(): void
exportAll(): string     // JSON gabungan semua key
importAll(json: string): { ok: boolean; error?: string }
```

Kewajiban:
- Bungkus semua operasi dengan `try/catch` — localStorage bisa dilarang (private mode,
  kebijakan browser).
- Jika localStorage tidak tersedia, app **tetap harus jalan** dengan penyimpanan di memori; tampilkan banner "progres tidak akan tersimpan".
- Validasi bentuk data setelah parse (cek `version` + cek tipe field kritikal).
  Jangan percaya isi localStorage.

### Tangga pemangkasan saat `QuotaExceededError` (R-21)

v1 hanya menulis "tangani QuotaExceededError" tanpa strategi. Urutannya sekarang mengikat,
dicoba berurutan sampai penulisan berhasil:

1. Pangkas `sessions` menjadi 100 entri terbaru → tulis ulang.
2. Pangkas `daily` menjadi 180 hari terakhir → tulis ulang.
3. Buang `confusions` dan `bigrams` seluruhnya → tulis ulang.
4. Masih gagal → beralih ke mode memori + banner
   "Penyimpanan browser penuh. Ekspor progresmu sebelum menutup tab."

Setiap tingkat yang terpakai dicatat di `typing:meta` supaya bisa diketahui saat debugging.

### Field opsional di `typing:meta` (tanpa naik versi)

`lastQuotaTrimLevel` dan `postureSeenAt` keduanya **opsional**, jadi menambahkannya
tidak membutuhkan migrasi: data lama yang tidak memilikinya tetap sah, dan validator
`typing:meta` memang hanya memeriksa field kritikal (`createdAt`). Aturannya: field
baru yang murni aditif dan boleh kosong **tidak** menaikkan `version`; yang mengubah
arti atau bentuk field lama **wajib** menaikkannya berikut migrasinya (§5).

## 5. Strategi migrasi

```ts
const migrations = {
  1: (data) => data,
  2: (data) => ({ ...data, /* transformasi */ version: 2 }),
};
```
Saat membaca: jika `data.version < CURRENT_VERSION`, jalankan migrasi berurutan.
Jika `data.version > CURRENT_VERSION` (pengguna kembali ke versi app lama): jangan proses, pakai fallback, dan jangan menimpa data — kecuali pengguna eksplisit reset.

## 6. Ekspor & impor (P1)

Format file: `typing-progress-YYYY-MM-DD.json`
```ts
{
  app: "typing-trainer",
  exportedAt: number,
  schemaVersion: number,
  data: { progress, sessions, keystats, settings, meta }
}
```
Impor wajib memvalidasi field `app` dan `schemaVersion` sebelum menulis apa pun, dan meminta konfirmasi karena akan menimpa data yang ada.

## 7. Privasi

Tidak ada data yang meninggalkan perangkat. Tidak ada analytics, tidak ada request pihak ketiga. Nyatakan ini secara eksplisit di halaman `/settings` — ini justru menjadi nilai jual.
