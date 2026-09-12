import { DEFAULT_INPUT_MODE, STORAGE_KEYS } from './schema.ts';
import type { InputMode, InputModeSurface } from './schema.ts';
import { read, write } from './index.ts';

/**
 * Penanda kecil yang dipakai lintas halaman: "sudah pernah dilihat" (ADR-027)
 * dan mode input (ADR-029).
 *
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

/**
 * Mode input per halaman (ADR-029).
 *
 * Dibaca defensif: nilai yang tidak dikenal — data lama, atau `localStorage`
 * yang diedit tangan — jatuh ke default, bukan mematikan layar sesi.
 */
export function readInputMode(surface: InputModeSurface): InputMode {
  const stored = read(STORAGE_KEYS.settings).inputMode?.[surface];
  return stored === 'strict' || stored === 'non-strict' ? stored : DEFAULT_INPUT_MODE[surface];
}

export function writeInputMode(surface: InputModeSurface, mode: InputMode): void {
  const settings = read(STORAGE_KEYS.settings);
  write(STORAGE_KEYS.settings, {
    ...settings,
    inputMode: { ...DEFAULT_INPUT_MODE, ...settings.inputMode, [surface]: mode },
  });
}
