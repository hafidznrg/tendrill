import { useCallback, useState } from 'react';
import { read, STORAGE_KEYS, write } from '@/lib/storage';
import type { ProgressData } from '@/lib/storage/schema.ts';
import type { DrillStats } from './drills.ts';

/**
 * Jembatan progres ↔ storage.
 *
 * Satu-satunya berkas di `features/curriculum/` yang menyentuh penyimpanan;
 * seluruh logikanya ada di `progress.ts` yang pure. Komponen tidak pernah
 * memanggil `localStorage` (dok. 06 §2 batasan 2, ditegakkan ESLint).
 *
 * Penulisan progres memakai `write`, bukan `scheduleWrite`: ia terjadi di layar
 * hasil atau di halaman daftar — bukan saat mengetik — dan ukurannya ~5 KB.
 * Menunda kelulusan sebuah lesson sampai browser senggang hanya menambah cara
 * kehilangannya.
 */
export interface UseProgressApi {
  progress: ProgressData;
  /** Ganti progres (nilai baru dari fungsi pure di progress.ts) dan simpan. */
  save: (next: ProgressData) => void;
  reload: () => void;
}

export function useProgress(): UseProgressApi {
  const [progress, setProgress] = useState<ProgressData>(() => read(STORAGE_KEYS.progress));

  const save = useCallback((next: ProgressData) => {
    setProgress(next);
    write(STORAGE_KEYS.progress, next);
  }, []);

  const reload = useCallback(() => {
    setProgress(read(STORAGE_KEYS.progress));
  }, []);

  return { progress, save, reload };
}

/**
 * Statistik tombol untuk generator berbobot (dok. 04 §7–§8).
 *
 * Bentuk `keystats` sudah cocok dengan `KeyUsage`; dibaca lewat fungsi ini
 * supaya generator tetap tidak tahu apa-apa soal storage.
 */
export function readDrillStats(): DrillStats {
  return read(STORAGE_KEYS.keystats).keys;
}
