import { STORAGE_KEYS, read } from '@/lib/storage';
import type { KeystatsData, SessionRecord } from '@/lib/storage/schema.ts';

/**
 * Satu-satunya pintu `/stats` ke storage (dok. 06 §2 batasan 2). Tidak ada
 * penyimpanan baru: semuanya turunan `typing:sessions` dan `typing:keystats`.
 */
export interface StatsSnapshot {
  /** terlama → terbaru, maks 200 (rolling buffer dok. 05) */
  sessions: SessionRecord[];
  keystats: KeystatsData;
}

export function loadStatsSnapshot(): StatsSnapshot {
  return {
    sessions: read(STORAGE_KEYS.sessions).items,
    keystats: read(STORAGE_KEYS.keystats),
  };
}
