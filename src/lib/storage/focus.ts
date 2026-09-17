/**
 * Mode fokus (ADR-044/045). Kembaran `theme.ts`: key kecil sendiri, karena sakelarnya
 * di bilah atas — bundel awal — dan membaca `typing:settings` dari sana menarik seluruh
 * lapisan storage (ADR-035). Dicerminkan ke `settings.focusMode` hanya saat ekspor/impor.
 */

const KEY = 'tendrill.focus';

export function readFocusMode(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeFocusMode(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
  } catch {
    // Kegagalan menulis tidak boleh membuat sakelar berhenti bekerja.
  }
}
