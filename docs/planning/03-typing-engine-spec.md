# 03 — Typing Engine Specification

**Versi:** v2 (revisi setelah dok. 11) · **Tanggal:** 2026-09-10

Dokumen paling penting. Semua fitur lain menempel di sini.
Engine harus **bebas React dan bebas DOM**, dan bisa diuji di Node murni.

> **Catatan revisi v2.** Versi 1 punya kontradiksi fatal: API-nya fungsional-immutable
> (`applyKey → SessionState` baru) sementara anggaran performanya melarang alokasi array
> per keystroke. v2 menyelesaikannya dengan mutasi eksplisit + deskripsi perubahan
> (R-01), akumulator inkremental (R-02), dan log kolumnar (R-03). Lihat dok. 11.

---

## 1. Model data sesi

```ts
type CharState = 'pending' | 'correct' | 'incorrect' | 'corrected';

interface CharCell {
  expected: string;
  typed: string | null;
  state: CharState;
  firstAttemptAt: number | null; // ms sejak keystroke pertama (performance.now)
}
```

### 1.1 Log keystroke kolumnar (R-03)

**Jangan** mengalokasikan objek per keystroke. Semua buffer dibuat sekali saat sesi dibuat:

```ts
interface KeystrokeLog {
  expectedCode: Uint16Array;   // charCodeAt karakter target
  actualCode:   Uint16Array;   // charCodeAt karakter yang diketik
  atMs:         Float64Array;  // ms sejak keystroke pertama
  indexAt:      Int32Array;    // posisi di teks target
  correct:      Uint8Array;    // 0 | 1
  count:        number;        // jumlah entri terisi
  capacity:     number;        // target.length * 2 + 64
  overflowed:   boolean;       // true jika count pernah mentok
}
```

Kalau `count === capacity`, **berhenti mencatat detail** dan set `overflowed = true`.
Akumulator (§1.2) tetap dinaikkan, jadi WPM & akurasi tetap benar; yang hilang hanya
detail `confusions` untuk sisa sesi. Ini melindungi dari pengguna yang menahan tombol
selama satu menit.

### 1.2 Akumulator inkremental (R-02)

Diperbarui O(1) per keystroke. **Inilah sumber angka untuk metrik live.**

```ts
interface Accumulators {
  total: number;            // seluruh keystroke tercatat
  correct: number;
  countInterval: number;    // jumlah jeda antar-keystroke
  meanInterval: number;     // Welford
  m2Interval: number;       // Welford → variance = m2 / (n - 1)
  lastKeystrokeAt: number;  // ms
}
```

Welford dipakai supaya stdev (untuk konsistensi) bisa dihitung tanpa menyimpan
seluruh array interval dan tanpa pemindaian ulang.

### 1.3 State sesi

```ts
interface SessionState {
  target: string;
  cells: CharCell[];
  lineStarts: number[];      // hasil wrapText(), lihat §8
  cursor: number;

  log: KeystrokeLog;
  acc: Accumulators;

  startedAt: number | null;  // performance.now() pada keystroke pertama
  endedAt: number | null;
  pausedMs: number;          // akumulasi waktu blur (R-05)
  pausedAt: number | null;
  status: 'idle' | 'running' | 'paused' | 'finished';
  voided: boolean;           // true → hasil tidak disimpan (R-05)
}
```

**Aturan emas (v2).** Ada dua jalur perhitungan yang sengaja dibedakan:

- **Log** = sumber kebenaran untuk **hasil akhir** dan analisis error. Dipindai **sekali**,
  di `computeResult()`.
- **Akumulator** = jalur cepat untuk **metrik live**. O(1), nol alokasi.

Keduanya wajib menghasilkan angka identik di akhir sesi. Ini **diuji sebagai invarian**
(dok. 09) — itulah yang menjaga keduanya tidak menyimpang.

## 2. Penanganan input

Listener `keydown` dipasang di `document`.

### Kunci yang diproses
| Input | Aksi |
|---|---|
| Karakter tercetak (`event.key.length === 1`) | Proses sebagai keystroke |
| `Backspace` | Mundurkan cursor 1, set cell ke `pending`, **jangan hapus dari log** |
| `Tab` | `preventDefault()`, restart sesi |
| `Escape` | Keluar sesi |
| `Enter` | Diproses hanya jika `expected === '\n'`; di state `finished` = ulangi |

### Kunci yang diabaikan (tanpa efek, tanpa `preventDefault`)
`Shift`, `Control`, `Alt`, `Meta`, `CapsLock`, tombol panah, F1–F12.

Juga diabaikan: event dengan `ctrlKey` atau `metaKey` aktif (kecuali yang diblokir
di bawah) — supaya pintasan browser pengguna tetap hidup.

### Key repeat (R-24)
`event.repeat === true` **tetap diproses sebagai keystroke sah**. Menahan tombol adalah
kesalahan mengetik yang nyata dan pantas tercermin di akurasi. Jangan "dirapikan"
menjadi diabaikan di kemudian hari.

### Yang wajib diblokir
- `Ctrl/Cmd + V`, **`Shift + Insert`**, dan event `paste` serta `drop` di area sesi (R-24).
- `Tab` default (jangan memindahkan fokus).
- Scroll default oleh Space selama sesi **belum selesai** — termasuk sebelum keystroke pertama dan selagi pause (ADR-043).

### Catatan layout keyboard
Untuk **menampilkan** tombol di virtual keyboard: `event.code` (posisi fisik — `KeyA`, `Semicolon`).
Untuk **membandingkan** dengan teks target: `event.key` (karakter aktual, sudah memperhitungkan Shift).
Memisahkan keduanya sejak awal membuat dukungan layout non-QWERTY nanti hanya perlu
mengganti tabel pemetaan.

### IME / dead keys
Abaikan event dengan `event.isComposing === true` atau `event.key === 'Dead'`.

## 3. Sumber waktu (R-04)

| Kebutuhan | Sumber |
|---|---|
| Semua pengukuran durasi (start, keystroke, pause, elapsed) | **`performance.now()`** — monotonik |
| Stempel waktu yang disimpan ke storage (`at`, `completedAt`) | `Date.now()` |

**Dilarang mencampur keduanya dalam satu pengurangan.** `Date.now()` bisa melompat karena
NTP, DST, atau sleep, dan itu akan menghasilkan WPM yang melonjak atau negatif.

## 4. Perhitungan metrik

1 "word" = 5 karakter, mengikuti standar industri agar hasil sebanding dengan aplikasi lain.

```
elapsedMs      = (lastKeystrokeAt - startedAt) - pausedMs
elapsedMinutes = elapsedMs / 60000

grossWPM = (acc.total / 5) / elapsedMinutes
netWPM   = (acc.correct / 5) / elapsedMinutes
accuracy = acc.correct / acc.total × 100
```

### Apa yang dicatat, dan apa yang tidak (ADR-019)

**Hanya percobaan pertama di tiap indeks yang masuk log dan akumulator.** Mengetik
ulang setelah backspace mengubah tampilan sel, menggerakkan cursor, dan tetap memakan
waktu — tetapi tidak pernah menambah `total` maupun `correct`.

Konsekuensinya `accuracy` = akurasi percobaan pertama: teks 50 karakter dengan 5 salah
yang semuanya dikoreksi tetap 90%, bukan 0% dan bukan 100%. Koreksi menurunkan WPM
dengan sendirinya karena waktunya terpakai (dok. 02 §4), tanpa perlu dihukum dua kali.
Alasan lengkap di ADR-019.

### Waktu di dalam log sudah dikurangi pause

`log.atMs` dan `CharCell.firstAttemptAt` menyimpan **waktu aktif** (`now - startedAt -
pausedMs`), bukan waktu dinding sejak mulai. Tanpa ini, jeda yang melintasi satu pause
akan tercatat sebagai latensi raksasa di jalur log sementara jalur akumulator
mengabaikannya — dan invarian "metrik(akumulator) == metrik(log)" (dok. 09 §2.1) pecah
tepat di kasus yang paling sulit di-debug.

### Keputusan penting
- **Angka utama yang ditampilkan = `netWPM`.** Jujur secara pedagogis; gross WPM memberi
  hadiah untuk mengetik ngawur dengan cepat.
- **Akurasi dihitung dari percobaan pertama.** Backspace memperbaiki teks tetapi tidak
  menghapus error dari catatan akurasi (ADR-003).
- `elapsedMs` dihitung dari keystroke pertama sampai keystroke **terakhir**, dikurangi
  waktu pause — bukan sampai tombol "selesai" ditekan.
- Jika `acc.total === 0` atau `elapsedMs <= 0`, semua metrik = 0. Jangan pernah `NaN`/`Infinity`
  sampai ke UI.

### Metrik turunan
- **Konsistensi** = `1 - (stdev / mean)` dari jeda antar-keystroke, dijepit ke 0–1.
  `stdev` diambil dari akumulator Welford (`sqrt(m2 / (n-1))`), tanpa menyimpan array.
- **Error per tombol** — dari pemindaian log, di-group by `expectedCode`.
- **Matriks kebingungan** — pasangan `(expected, actual)` tersering; sumber diagnosis
  "kamu sering mengetik `e` sebagai `r`".
- **Latensi per tombol (R-18)** — `sum(interval)` dan `count` per `expectedCode`.
  Ini yang mendiagnosis pengguna yang *tidak salah tapi lambat*, dan yang membuka
  plateau 50→70 WPM. Diagregasi ke `keystats` (dok. 05).
- **(P1) Latensi bigram** — Map `"th" → {sumMs, count}` untuk 50 transisi paling lambat.

## 5. Siklus hidup, pause, dan void (R-05)

Dua konsep yang di v1 tercampur, sekarang dipisah tegas:

| Peristiwa | Perilaku |
|---|---|
| Window/tab kehilangan fokus saat `running` | `status = 'paused'`, catat `pausedAt`, tampilkan overlay, **hentikan loop metrik** |
| Fokus kembali + keystroke berikutnya | `pausedMs += now - pausedAt`, `status = 'running'`. **Sesi tetap sah.** |
| Jeda antar-keystroke > 30 detik **saat fokus tetap ada** | `voided = true`, sesi diakhiri, hasil **tidak disimpan**, layar hasil menjelaskan alasannya |

Tanpa pemisahan ini `elapsedMs` salah, dan seluruh WPM ikut salah.

`finishSession()` bersifat **idempoten** — memanggilnya dua kali tidak menggandakan apa pun.

## 6. Anggaran performa

| Metrik | Batas |
|---|---|
| keydown → karakter berubah di layar (p95) | **≤ 8 ms** (banyak layar 120 Hz) |
| idem (p99) | ≤ 16 ms |
| Komponen React yang re-render per keystroke | **0** (lihat §7) |
| Alokasi heap per keystroke | 0 objek, 0 array |
| Reflow paksa per keystroke | 0 |

### Aturan implementasi yang mengikat
1. `SessionState` disimpan di `useRef`, bukan `useState`.
2. **Lapisan teks dirender React sekali, lalu diperbarui imperatif** (§7).
3. Caret digeser dengan `transform`, koordinatnya **dihitung aritmetika**, tidak pernah
   dari `getBoundingClientRect()` (§8).
4. Metrik live dari akumulator (§1.2), tidak pernah dari pemindaian log.
5. Dilarang `JSON.parse`/`stringify` atau menulis `localStorage` selama `running`.
   Persist hanya setelah `finished`, dan dijadwalkan saat idle (dok. 05).
6. Loop metrik hanya hidup saat `status === 'running'`; `requestAnimationFrame` dengan
   gerbang 250 ms, bukan `setInterval` (R-09).

## 7. Lapisan teks imperatif (R-08)

`memo` mencegah re-render, **bukan** reconciliation: setiap render induk tetap membuat dan
membandingkan 500 elemen React. Karena itu teks tidak dikelola React setelah mount.

```ts
// mount sekali
<span ref={collect} class="c-pending">t</span> ...   // N span statis

// per keystroke
for (const i of outcome.dirty) {
  spans[i].className = CLASS[state[i]];   // 1–2 penulisan DOM
}
```

Rata-rata **1–2 penulisan DOM per keystroke, nol pekerjaan React.**

Dengan virtual keyboard menyala, jumlahnya menjadi **4**: 1 `className` karakter,
1 `transform` caret, dan 2 `className` tombol (matikan yang lama, nyalakan yang
baru). Tetap O(1) dan tetap nol pekerjaan React — keyboard memakai jalur imperatif
yang sama (dok. 07 §4). Angka ini diverifikasi di browser pada 2026-09-11.
React hanya dipakai ulang saat perubahan struktural: ganti target, restart, resize.
`renderTick` di dok. 06 §4 karenanya hanya untuk kasus struktural itu.

## 8. Tata letak baris & caret (R-06, R-07)

Pembungkusan baris **tidak** diserahkan ke CSS — kalau diserahkan, engine tidak tahu
`row`/`col` dan posisi caret mustahil dihitung.

```ts
wrapText(target: string, cols: number): number[]   // indeks awal tiap baris
```

Greedy word-wrap, tidak memotong kata di tengah, dihitung **sekali** per sesi
(`lineStarts`). Fungsi murni, dites tanpa DOM.

Dari situ semuanya aritmetika:

```
row = jumlah lineStarts yang <= cursor, dikurangi 1
col = cursor - lineStarts[row]
x   = col * charWidth
y   = row * lineHeight
```

### Pengukuran `charWidth` (wajib)
Diukur **sekali** dari satu elemen contoh, dan **wajib setelah `await document.fonts.ready`**.
Mengukur sebelum webfont termuat membuat caret meleset permanen.
Ukur ulang pada `resize` dan perubahan zoom (`visualViewport`).

Gulir per baris = `transform: translateY(-row * lineHeight)` pada kontainer teks.

## 9. API engine (kontrak v2)

```ts
createSession(target: string, cols: number): SessionState

interface KeyOutcome {
  accepted: boolean;      // false = event diabaikan
  dirty: number[];        // indeks cell yang berubah (biasanya 1–2)
  cursorMoved: boolean;
  finished: boolean;
}

applyKey(s: SessionState, key: string, atMs: number): KeyOutcome
setInputMode(s: SessionState, strict: boolean): void                 // ADR-029
applyBackspace(s: SessionState): KeyOutcome
pause(s: SessionState, atMs: number): void
resume(s: SessionState, atMs: number): void
finishSession(s: SessionState, atMs: number): SessionResult | null  // null jika voided
computeLiveMetrics(s: SessionState, nowMs: number): LiveMetrics     // O(1), dari akumulator
computeResult(s: SessionState): SessionResult                       // O(n), sekali saja
wrapText(target: string, cols: number): number[]
```

### Mode strict (ADR-029)

`applyKey` punya satu percabangan mode, dan hanya satu:

| | non-strict | strict |
|---|---|---|
| tombol benar | kursor maju | kursor maju |
| tombol salah | ditandai, **kursor maju** | ditandai, **kursor TIDAK maju** |
| pencatatan | percobaan pertama masuk log & akumulator | **sama persis** |

Yang **tidak** berubah di mode strict: akurasi tetap dari percobaan pertama (ADR-003),
percobaan salah berulang di sel yang sama tetap hanya dihitung sekali (ADR-019), dan
`KeyOutcome.cursorMoved` menjadi `false` — sehingga pelukis caret dan sorotan tombol
berikutnya tidak dipanggil, dan panduan jari **tetap menyala di tombol yang ditunggu**.

`dirty` adalah array yang **dipakai ulang** (dialokasikan sekali per sesi, panjangnya
diubah dengan `length = 0`) supaya benar-benar nol alokasi per keystroke.

```ts
interface SessionResult {
  target: string;
  durationMs: number;        // sudah dikurangi pausedMs
  grossWPM: number;
  netWPM: number;
  accuracy: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  consistency: number;
  errorsByKey: Record<string, number>;
  latencyByKey: Record<string, { sumMs: number; count: number }>;   // R-18
  confusions: Array<{ expected: string; actual: string; count: number }>;
  slowBigrams?: Array<{ pair: string; meanMs: number; count: number }>;  // P1
  logOverflowed: boolean;
  completedAt: number;       // Date.now()
}
```

Semua fungsi ini wajib punya unit test, plus property test untuk invariannya (dok. 09).

## 10. Kasus tepi yang harus ditangani

| Kasus | Perilaku yang benar |
|---|---|
| Backspace di posisi 0 | Tidak terjadi apa-apa, bukan error |
| Mengetik setelah karakter terakhir | Diabaikan; sesi langsung `finished` |
| Tab ditekan saat `finished` | Restart, bukan pindah fokus |
| Window kehilangan fokus saat `running` | `paused`, overlay, loop metrik berhenti; resume saat keystroke berikutnya |
| Jeda > 30 detik dengan fokus tetap ada | Sesi `voided`, hasil dibuang, alasan dijelaskan |
| Key repeat (menahan tombol) | Diproses normal sebagai keystroke sah |
| Log menyentuh kapasitas | `overflowed = true`; metrik tetap benar, detail berhenti dicatat |
| Teks target mengandung spasi ganda / unicode | Dinormalisasi di sumber konten, bukan di engine |
| `charWidth` diukur sebelum font siap | Dicegah oleh `document.fonts.ready`; ukur ulang saat resize |
| Sesi dibuat dengan target string kosong | `finished` seketika, metrik 0, tidak crash |
