import { createAccumulators, recordKeystroke, resetAccumulators } from './accumulators.ts';
import { createLog, pushLog, resetLog } from './log.ts';
import { computeResult } from './metrics.ts';
import type { CharCell, KeyOutcome, SessionResult, SessionState } from './types.ts';
import { wrapText } from './wrap.ts';

/**
 * Siklus hidup sesi (dok. 03 §5 dan §9).
 *
 * Seluruh file ini bermutasi dengan sengaja (ADR-007): `applyKey` mengubah
 * `SessionState` di tempat dan mengembalikan DESKRIPSI perubahan, bukan state
 * baru. Menyalin array 500 karakter tiap keystroke adalah persis yang dilarang
 * anggaran performa dok. 03 §6.
 */

/** Jeda maksimum antar-keystroke selagi fokus tetap ada (dok. 03 §5). */
export const VOID_THRESHOLD_MS = 30_000;

/** Outcome tunggal yang dipakai ulang — nol alokasi per keystroke. */
interface InternalOutcome extends KeyOutcome {
  accepted: boolean;
  dirty: number[];
  cursorMoved: boolean;
  finished: boolean;
}

function makeCell(expected: string): CharCell {
  return { expected, typed: null, state: 'pending', firstAttemptAt: null };
}

export interface InternalSessionState extends SessionState {
  /**
   * Apakah percobaan PERTAMA di tiap indeks benar. Disimpan terpisah dari
   * `CharCell` supaya bentuk sel tetap persis kontrak dok. 03 §1, dan supaya
   * 'corrected' berarti "pernah salah, sekarang benar" — bukan sekadar
   * "diketik ulang".
   */
  readonly _firstOk: Uint8Array;
  readonly _outcome: InternalOutcome;
}

export function createSession(target: string, cols: number): SessionState {
  const cells: CharCell[] = new Array(target.length);
  for (let i = 0; i < target.length; i++) cells[i] = makeCell(target[i]!);

  const state: InternalSessionState = {
    target,
    cells,
    lineStarts: wrapText(target, cols),
    cursor: 0,
    log: createLog(target.length),
    acc: createAccumulators(),
    startedAt: null,
    endedAt: null,
    pausedMs: 0,
    pausedAt: null,
    // Target kosong selesai seketika — metrik 0, tidak crash (dok. 03 §10).
    status: target.length === 0 ? 'finished' : 'idle',
    voided: false,
    _dirty: [],
    _result: null,
    _firstOk: new Uint8Array(target.length),
    _outcome: { accepted: false, dirty: [], cursorMoved: false, finished: false },
  };
  state._outcome.dirty = state._dirty;
  return state;
}

/** Kembalikan sesi ke `idle` bersih tanpa mengalokasikan buffer baru. */
/**
 * Hitung ulang pembungkusan baris untuk lebar baru (ADR-028).
 *
 * Dipanggil saat lebar area teks berubah — jendela diubah ukurannya, zoom
 * browser, atau font akhirnya termuat. Ia **hanya** menyentuh `lineStarts`:
 * sel, log, akumulator, kursor, dan status tidak ikut berubah.
 *
 * Kenapa ini ada sama sekali: sebelum ADR-028, satu-satunya cara mengubah `cols`
 * adalah membuat sesi baru — sehingga mengubah ukuran jendela di tengah drill
 * akan **menghapus ketikan pengguna**. Membungkus ulang bukan memulai ulang.
 *
 * Bukan jalur input, jadi alokasi array baru di sini tidak melanggar apa pun
 * (dok. 03 §6 mengikat jalur keystroke, bukan perubahan geometri).
 */
export function rewrapSession(s: SessionState, cols: number): void {
  if (cols <= 0) return;
  s.lineStarts = wrapText(s.target, cols);
}

export function restartSession(s: SessionState): void {
  const st = s as InternalSessionState;
  for (let i = 0; i < s.cells.length; i++) {
    const cell = s.cells[i]!;
    cell.typed = null;
    cell.state = 'pending';
    cell.firstAttemptAt = null;
  }
  st._firstOk.fill(0);
  resetLog(s.log);
  resetAccumulators(s.acc);
  s.cursor = 0;
  s.startedAt = null;
  s.endedAt = null;
  s.pausedMs = 0;
  s.pausedAt = null;
  s.status = s.target.length === 0 ? 'finished' : 'idle';
  s.voided = false;
  s._result = null;
}

/**
 * Kosongkan `_dirty` TANPA mengalokasikan.
 *
 * Sengaja `pop()`, bukan `length = 0`. Keduanya tampak setara dan hanya satu yang
 * benar: `length = 0` membuat V8 memangkas backing store array, lalu `push`
 * berikutnya mengalokasikan backing store baru — **152 byte per keystroke**,
 * diukur `npm run perf:heap` pada 2026-09-11. Identitas array-nya tetap sama,
 * jadi property test identitas tidak pernah bisa menangkapnya.
 *
 * `_dirty` tidak pernah berisi lebih dari satu indeks, jadi loop ini satu iterasi.
 */
function clearDirty(st: InternalSessionState): void {
  while (st._dirty.length > 0) st._dirty.pop();
}

function outcome(
  s: SessionState,
  accepted: boolean,
  cursorMoved: boolean,
  finished: boolean,
): KeyOutcome {
  const o = (s as InternalSessionState)._outcome;
  o.accepted = accepted;
  o.cursorMoved = cursorMoved;
  o.finished = finished;
  return o;
}

function endSession(s: SessionState, atMs: number): void {
  if (s.status === 'finished') return;
  s.status = 'finished';
  s.endedAt = atMs;
}

/**
 * Proses satu karakter tercetak.
 *
 * `key` sudah berupa karakter final (hasil `event.key`, bukan `event.code`) —
 * pemisahan itu dijaga di lapisan input (dok. 03 §2), supaya layout non-QWERTY
 * nanti cukup mengganti tabel pemetaan tanpa menyentuh engine.
 */
export function applyKey(s: SessionState, key: string, atMs: number): KeyOutcome {
  const st = s as InternalSessionState;
  clearDirty(st);

  if (s.status === 'finished') return outcome(s, false, false, true);
  if (key.length !== 1) return outcome(s, false, false, false);

  // Mengetik setelah karakter terakhir diabaikan; sesi memang sudah habis.
  if (s.cursor >= s.target.length) {
    endSession(s, atMs);
    return outcome(s, false, false, true);
  }

  if (s.status === 'paused') {
    resume(s, atMs);
  } else if (s.status === 'running' && s.acc.total > 0) {
    // Diam terlalu lama DENGAN fokus tetap ada membatalkan sesi. Pause (blur)
    // ditangani jalur lain dan TIDAK membatalkan apa pun (dok. 03 §5).
    if (atMs - s.acc.lastKeystrokeAt > VOID_THRESHOLD_MS) {
      s.voided = true;
      endSession(s, atMs);
      return outcome(s, false, false, true);
    }
  }

  if (s.status === 'idle') {
    // Timer mulai pada keystroke pertama, bukan saat sesi dibuat.
    s.startedAt = atMs;
    s.status = 'running';
  }

  const i = s.cursor;
  const cell = s.cells[i]!;
  const correct = key === cell.expected;
  const isFirstAttempt = cell.firstAttemptAt === null;
  // Waktu di log sudah dikurangi pausedMs, jadi ia mengukur WAKTU AKTIF. Ini
  // yang membuat jeda antar-keystroke versi log identik dengan versi akumulator
  // meski ada pause di antaranya — invarian terpenting dok. 09 §2.1.
  const relAt = atMs - s.startedAt! - s.pausedMs;

  if (isFirstAttempt) {
    // Hanya percobaan pertama yang masuk log & akumulator (ADR-019). Mengetik
    // ulang setelah backspace tetap memakan waktu — dan waktu itu menurunkan
    // WPM dengan sendirinya — tetapi tidak pernah memperbaiki akurasi.
    const interval = s.acc.total === 0 ? null : atMs - s.acc.lastKeystrokeAt;
    cell.firstAttemptAt = relAt;
    st._firstOk[i] = correct ? 1 : 0;
    recordKeystroke(s.acc, correct, atMs, interval);
    pushLog(s.log, cell.expected.charCodeAt(0), key.charCodeAt(0), relAt, i, correct);
  }

  cell.typed = key;
  cell.state = correct ? (st._firstOk[i] === 1 ? 'correct' : 'corrected') : 'incorrect';
  st._dirty.push(i);
  s.cursor = i + 1;

  const finished = s.cursor >= s.target.length;
  if (finished) endSession(s, atMs);
  return outcome(s, true, true, finished);
}

/**
 * Mundur satu karakter.
 *
 * Sengaja TIDAK menghapus apa pun dari log: akurasi dihitung dari percobaan
 * pertama, dan backspace tidak boleh bisa menghapus jejak kesalahan (ADR-003).
 */
export function applyBackspace(s: SessionState): KeyOutcome {
  const st = s as InternalSessionState;
  clearDirty(st);

  if (s.status === 'finished') return outcome(s, false, false, true);
  if (s.cursor === 0) return outcome(s, false, false, false);

  const i = s.cursor - 1;
  const cell = s.cells[i]!;
  cell.typed = null;
  cell.state = 'pending';
  st._dirty.push(i);
  s.cursor = i;

  return outcome(s, true, true, false);
}

/** Window kehilangan fokus. Sesi TETAP SAH — hanya waktunya yang beku (R-05). */
export function pause(s: SessionState, atMs: number): void {
  if (s.status !== 'running') return;
  s.status = 'paused';
  s.pausedAt = atMs;
}

export function resume(s: SessionState, atMs: number): void {
  if (s.status !== 'paused' || s.pausedAt === null) return;
  const pausedFor = atMs - s.pausedAt;
  s.pausedMs += pausedFor;
  // Geser juga penanda keystroke terakhir, supaya jeda yang dihitung sebagai
  // latensi tidak ikut memuat waktu pause — dan supaya pause panjang tidak
  // langsung memicu ambang void pada keystroke berikutnya.
  if (s.acc.total > 0) s.acc.lastKeystrokeAt += pausedFor;
  s.pausedAt = null;
  s.status = 'running';
}

/**
 * Akhiri sesi dan hasilkan `SessionResult`. **Idempoten** (dok. 03 §5):
 * memanggilnya dua kali mengembalikan objek yang sama, bukan menghitung ulang.
 *
 * Mengembalikan `null` untuk sesi yang di-void — hasilnya memang tidak boleh
 * disimpan, dan layar hasil menjelaskan alasannya alih-alih menampilkan angka.
 */
export function finishSession(s: SessionState, atMs: number): SessionResult | null {
  endSession(s, atMs);
  if (s.voided) return null;
  if (s._result === null) s._result = computeResult(s);
  return s._result;
}
