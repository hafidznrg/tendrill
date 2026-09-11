import type { SessionResult } from '@/lib/engine';
import { appendSession, pruneKeystats, read, scheduleWrite, STORAGE_KEYS } from '@/lib/storage';
import type { KeystatsData, SessionRecord, SessionsData } from '@/lib/storage/schema.ts';

/**
 * Menyimpan hasil sesi (dok. 05 §1 poin 3–4).
 *
 * Dua aturan yang membentuk seluruh file ini:
 * - **Simpan hasil, bukan proses.** Log keystroke mentah tidak pernah disimpan;
 *   ia membengkakkan storage tanpa memberi apa pun yang tidak bisa diturunkan
 *   dari agregat.
 * - **Tidak ada penulisan selama mengetik.** Semua lewat `scheduleWrite`, yang
 *   menunggu browser senggang; flush paksa saat tab disembunyikan menjaga agar
 *   tidak ada yang hilang.
 *
 * Fungsi transformasinya dipisah dari pemanggilan storage supaya bisa dites
 * tanpa menyentuh localStorage sama sekali.
 */

export interface PersistOptions {
  source: SessionRecord['source'];
  lessonId?: string;
  mode?: SessionRecord['mode'];
}

/** Ambang "lambat" untuk `slowCount` — dipakai heatmap kelambatan (R-18). */
const SLOW_KEY_MS = 400;

function newId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Tanggal lokal YYYY-MM-DD — agregat harian harus mengikuti hari PENGGUNA. */
export function localDateKey(at: number): string {
  const d = new Date(at);
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function toSessionRecord(result: SessionResult, options: PersistOptions): SessionRecord {
  return {
    id: newId(),
    at: result.completedAt,
    source: options.source,
    ...(options.lessonId === undefined ? {} : { lessonId: options.lessonId }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    durationMs: Math.round(result.durationMs),
    netWpm: +result.netWPM.toFixed(2),
    grossWpm: +result.grossWPM.toFixed(2),
    accuracy: +result.accuracy.toFixed(2),
    consistency: +result.consistency.toFixed(3),
    totalKeystrokes: result.totalKeystrokes,
    correctKeystrokes: result.correctKeystrokes,
  };
}

/**
 * Gabungkan hasil sesi ke dalam statistik agregat.
 *
 * Murni: menerima keystats lama, mengembalikan yang baru. Inilah yang membuat
 * "apakah agregatnya benar" bisa diuji tanpa storage.
 */
export function mergeKeystats(
  previous: KeystatsData,
  result: SessionResult,
  record: SessionRecord,
): KeystatsData {
  const keys: KeystatsData['keys'] = { ...previous.keys };

  // `attempts` dihitung dari seluruh karakter target yang dicoba, bukan hanya
  // yang salah — tanpa itu, rasio error per tombol tidak punya penyebut.
  const attemptsByKey = new Map<string, number>();
  for (const [char, entry] of Object.entries(result.latencyByKey)) {
    attemptsByKey.set(char, entry.count);
  }
  for (const [char, errors] of Object.entries(result.errorsByKey)) {
    if (!attemptsByKey.has(char)) attemptsByKey.set(char, errors);
  }

  for (const [char, attempts] of attemptsByKey) {
    const latency = result.latencyByKey[char];
    const errors = result.errorsByKey[char] ?? 0;
    const before = keys[char] ?? { attempts: 0, errors: 0, totalMs: 0, slowCount: 0 };

    const meanMs = latency && latency.count > 0 ? latency.sumMs / latency.count : 0;
    keys[char] = {
      attempts: before.attempts + attempts,
      errors: before.errors + errors,
      totalMs: before.totalMs + (latency?.sumMs ?? 0),
      slowCount: before.slowCount + (meanMs > SLOW_KEY_MS ? 1 : 0),
    };
  }

  const confusions: KeystatsData['confusions'] = { ...previous.confusions };
  for (const c of result.confusions) {
    const key = `${c.expected}>${c.actual}`;
    confusions[key] = (confusions[key] ?? 0) + c.count;
  }

  // Agregat harian: rata-rata dibobot jumlah sesi, bukan rata-rata dari
  // rata-rata — kalau tidak, sesi 5 detik punya bobot sama dengan sesi 5 menit.
  const dayKey = localDateKey(record.at);
  const day = previous.daily[dayKey];
  const sessions = (day?.sessions ?? 0) + 1;
  const daily: KeystatsData['daily'] = {
    ...previous.daily,
    [dayKey]: {
      sessions,
      ms: (day?.ms ?? 0) + record.durationMs,
      avgWpm: +(((day?.avgWpm ?? 0) * (sessions - 1) + record.netWpm) / sessions).toFixed(2),
      avgAccuracy: +(
        ((day?.avgAccuracy ?? 0) * (sessions - 1) + record.accuracy) /
        sessions
      ).toFixed(2),
    },
  };

  return pruneKeystats({ ...previous, keys, confusions, daily });
}

/**
 * Simpan satu hasil sesi. Dipanggil setelah layar hasil ter-paint.
 *
 * Sesi yang di-void tidak pernah sampai ke sini — `finishSession` sudah
 * mengembalikan `null` untuknya (dok. 03 §5).
 */
export function persistSessionResult(
  result: SessionResult,
  options: PersistOptions,
): SessionRecord {
  const record = toSessionRecord(result, options);

  const sessions: SessionsData = appendSession(read(STORAGE_KEYS.sessions), record);
  const keystats = mergeKeystats(read(STORAGE_KEYS.keystats), result, record);

  scheduleWrite(STORAGE_KEYS.sessions, sessions);
  scheduleWrite(STORAGE_KEYS.keystats, keystats);

  return record;
}

/** Hasil terbaik sebelumnya untuk satu lesson, sebagai pembanding layar hasil. */
export function previousBestFor(lessonId: string): { netWpm: number; accuracy: number } | null {
  const { items } = read(STORAGE_KEYS.sessions);
  let best: { netWpm: number; accuracy: number } | null = null;
  for (const item of items) {
    if (item.lessonId !== lessonId) continue;
    if (!best || item.netWpm > best.netWpm) {
      best = { netWpm: item.netWpm, accuracy: item.accuracy };
    }
  }
  return best;
}
