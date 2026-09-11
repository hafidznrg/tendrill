import { CURRENT_VERSION, type StorageKey } from './schema.ts';

/**
 * Migrasi skema (dok. 05 §5).
 *
 * Dua arah, dua perlakuan yang sangat berbeda:
 * - `version < CURRENT_VERSION` → jalankan migrasi berurutan sampai terkini.
 * - `version > CURRENT_VERSION` → pengguna baru saja membuka versi app yang
 *   LEBIH LAMA daripada datanya. Jangan proses, jangan menimpa, pakai default.
 *   Menimpa di sini berarti menghancurkan progres seseorang karena mereka
 *   kebetulan membuka tab lama.
 */

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Peta migrasi per key. Kunci `n` berarti "ubah data versi n menjadi versi n+1".
 * Masih kosong karena semua key baru ada di versi 1 — dan itu wajar. Yang tidak
 * wajar adalah menambah field baru tanpa menambah entri di sini.
 */
const MIGRATIONS: Partial<Record<StorageKey, Record<number, Migration>>> = {};

export type MigrateOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: 'from-future' | 'no-path' };

export function migrate(key: StorageKey, raw: Record<string, unknown>): MigrateOutcome {
  const version = typeof raw['version'] === 'number' ? raw['version'] : 0;

  if (version > CURRENT_VERSION) return { ok: false, reason: 'from-future' };
  if (version === CURRENT_VERSION) return { ok: true, data: raw };

  const steps = MIGRATIONS[key];
  let data = raw;
  for (let v = version; v < CURRENT_VERSION; v++) {
    const step = steps?.[v];
    if (!step) return { ok: false, reason: 'no-path' };
    data = step(data);
  }
  data['version'] = CURRENT_VERSION;
  return { ok: true, data };
}
