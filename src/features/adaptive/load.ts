import { STORAGE_KEYS, read } from '@/lib/storage';
import { adaptiveReadiness, type AdaptiveReadiness } from './adaptive.ts';

/**
 * Satu-satunya pintu latihan adaptif ke storage (dok. 06 §2 batasan 2).
 * Tidak ada penyimpanan baru — seluruhnya turunan `sessions` dan `keystats`.
 */
export function loadAdaptiveReadiness(): AdaptiveReadiness {
  return adaptiveReadiness(
    read(STORAGE_KEYS.sessions).items.length,
    read(STORAGE_KEYS.keystats),
  );
}
