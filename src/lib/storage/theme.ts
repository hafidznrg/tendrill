/**
 * Satu-satunya modul yang boleh menyentuh localStorage untuk tema
 * (dok. 06 §2 batasan 2). Storage layer penuh datang di ekor Fase 1
 * (dok. 05); ini potongan minimalnya supaya Fase 0 punya toggle tema
 * yang persisten tanpa komponen menyentuh storage langsung.
 */

export type Theme = 'light' | 'dark';

const KEY = 'tendrill.theme';

export function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Tema yang dipilih eksplisit, atau null kalau pengguna belum pernah memilih. */
export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : systemTheme();
  } catch {
    // Mode privat / storage diblokir → jalan terus dari preferensi sistem.
    return systemTheme();
  }
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Kegagalan menulis tidak boleh membuat toggle berhenti bekerja.
  }
}
