import { STORAGE_KEYS, read } from '@/lib/storage';
import type { SessionRecord } from '@/lib/storage/schema.ts';

/**
 * Riwayat latihan bebas (dok. 02 §6).
 *
 * Di sini, bukan di komponen: komponen tidak boleh menyentuh `localStorage`
 * (dok. 06 §2 batasan 2, ditegakkan ESLint). Tidak ada penyimpanan terpisah —
 * `typing:sessions` sudah menyimpan `source` sejak Fase 1, jadi riwayat ini
 * hanya penyaringan, bukan data baru yang bisa menyimpang.
 */

export const HISTORY_LIMIT = 10;

export function recentPracticeSessions(limit = HISTORY_LIMIT): SessionRecord[] {
  const { items } = read(STORAGE_KEYS.sessions);
  const practice = items.filter((item) => item.source === 'practice');
  // `items` tersimpan terlama → terbaru (dok. 05 §1). Yang ditampilkan terbaru
  // lebih dulu: riwayat yang membuka dengan sesi enam bulan lalu tidak berguna.
  return practice.slice(-limit).reverse();
}
