/**
 * Tipe inti engine. Mengikat dok. 03 §1 dan §9.
 *
 * Engine ini BEBAS React dan BEBAS DOM (dok. 06 §2 batasan 1) — seluruh file
 * di folder ini harus bisa dijalankan di Node murni.
 *
 * Dua aturan yang membentuk hampir semua keputusan di sini:
 * 1. **Nol alokasi heap per keystroke** (dok. 03 §6). Semua buffer dibuat sekali
 *    saat sesi dibuat, lalu dimutasi. Tidak ada objek/array baru di jalur input.
 * 2. **Dua jalur perhitungan yang sengaja dipisah** (dok. 03 §1 "Aturan emas"):
 *    akumulator O(1) untuk metrik live, log untuk hasil akhir. Keduanya wajib
 *    menghasilkan angka identik — dijaga property test (dok. 09 §2.1).
 */

export type CharState = 'pending' | 'correct' | 'incorrect' | 'corrected';

export interface CharCell {
  expected: string;
  typed: string | null;
  state: CharState;
  /** ms sejak keystroke pertama; null kalau belum pernah dicoba. */
  firstAttemptAt: number | null;
}

/**
 * Log keystroke kolumnar (dok. 03 §1.1).
 *
 * Typed array, bukan array objek: satu entri = satu slot di tiap kolom. Inilah
 * yang membuat pencatatan keystroke tidak mengalokasikan apa pun.
 */
export interface KeystrokeLog {
  expectedCode: Uint16Array;
  actualCode: Uint16Array;
  /** ms sejak keystroke pertama. */
  atMs: Float64Array;
  indexAt: Int32Array;
  /** 0 | 1 */
  correct: Uint8Array;
  count: number;
  capacity: number;
  /** true kalau count pernah mentok — detail berhenti dicatat, metrik tetap benar. */
  overflowed: boolean;
}

/**
 * Akumulator inkremental (dok. 03 §1.2). Diperbarui O(1) per keystroke dan
 * menjadi satu-satunya sumber angka untuk metrik live.
 */
export interface Accumulators {
  total: number;
  correct: number;
  /** jumlah jeda antar-keystroke */
  countInterval: number;
  /** rata-rata jeda, Welford */
  meanInterval: number;
  /** sum of squares of differences, Welford → variance = m2 / (n - 1) */
  m2Interval: number;
  /** performance.now() absolut keystroke terakhir yang tercatat */
  lastKeystrokeAt: number;
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface SessionState {
  target: string;
  cells: CharCell[];
  /** indeks awal tiap baris, hasil wrapText() (dok. 03 §8) */
  lineStarts: number[];
  cursor: number;

  log: KeystrokeLog;
  acc: Accumulators;

  /** performance.now() pada keystroke pertama; null selama masih idle */
  startedAt: number | null;
  endedAt: number | null;
  /** akumulasi waktu blur (dok. 03 §5) */
  pausedMs: number;
  pausedAt: number | null;
  status: SessionStatus;
  /** true → hasil tidak disimpan (jeda > 30 detik dengan fokus tetap ada) */
  voided: boolean;
  /**
   * Mode input (ADR-029). true = strict: tombol salah **menahan** kursor.
   *
   * Hidup di sesi, bukan di modul, supaya engine tetap murni dan supaya dua
   * sesi dengan mode berbeda bisa hidup berdampingan (mis. test).
   */
  strict: boolean;

  /** Buffer internal yang DIPAKAI ULANG. Jangan pernah menyimpan referensinya. */
  readonly _dirty: number[];
  /** Hasil di-cache supaya finishSession() idempoten (dok. 03 §5). */
  _result: SessionResult | null;
}

/**
 * Deskripsi perubahan akibat satu keystroke (dok. 03 §9).
 *
 * `dirty` adalah array yang DIPAKAI ULANG antar pemanggilan — isinya hanya sah
 * sampai pemanggilan `applyKey`/`applyBackspace` berikutnya. Menyalinnya
 * (`[...outcome.dirty]`) mengembalikan alokasi per keystroke yang justru
 * dihindari oleh seluruh desain ini.
 */
export interface KeyOutcome {
  accepted: boolean;
  dirty: number[];
  cursorMoved: boolean;
  finished: boolean;
}

export interface LiveMetrics {
  elapsedMs: number;
  grossWPM: number;
  netWPM: number;
  accuracy: number;
  /** posisi cursor, supaya UI tidak perlu membaca SessionState */
  progress: number;
}

export interface KeyLatency {
  sumMs: number;
  count: number;
}

export interface Confusion {
  expected: string;
  actual: string;
  count: number;
}

export interface SessionResult {
  target: string;
  /** sudah dikurangi pausedMs */
  durationMs: number;
  grossWPM: number;
  netWPM: number;
  accuracy: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
  consistency: number;
  errorsByKey: Record<string, number>;
  latencyByKey: Record<string, KeyLatency>;
  confusions: Confusion[];
  logOverflowed: boolean;
  /** Date.now() — satu-satunya tempat jam dinding dipakai (dok. 03 §3) */
  completedAt: number;
}
