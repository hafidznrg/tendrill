import { STORAGE_KEYS } from './schema.ts';
import { read, write } from './index.ts';

/**
 * Penanda "sudah pernah dilihat" (ADR-027).
 *
 * Berdiri sendiri, bukan di dalam `PosturePage`, karena beranda perlu tahu
 * jawabannya untuk menentukan tujuan CTA — dan mengimpornya dari halaman itu
 * akan menarik seluruh chunk `/posture` ke bundel beranda (dok. 06 §6).
 */

export function hasSeenPosture(): boolean {
  return typeof read(STORAGE_KEYS.meta).postureSeenAt === 'number';
}

export function markPostureSeen(at: number = Date.now()): void {
  const meta = read(STORAGE_KEYS.meta);
  if (typeof meta.postureSeenAt === 'number') return;
  write(STORAGE_KEYS.meta, { ...meta, postureSeenAt: at });
}
