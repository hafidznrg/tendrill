import { useEffect } from 'react';

/**
 * Penangkapan input (dok. 03 §2).
 *
 * Listener dipasang di `document` — **tidak ada `<input>` yang harus diklik
 * dulu** (dok. 02 §4). Hook ini memutuskan event mana yang sampai ke engine dan
 * event mana yang diblokir; ia sengaja tidak tahu apa pun tentang sesi.
 */

export interface KeyboardCaptureHandlers {
  onChar: (char: string, event: KeyboardEvent) => void;
  onBackspace: () => void;
  onRestart: () => void;
  onExit: () => void;
  /** true selama sesi belum selesai (idle/running/paused) — Space diblokir dari scroll. */
  isActive: () => boolean;
}

/** Tombol yang diabaikan tanpa preventDefault (dok. 03 §2). */
const IGNORED = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'Delete',
  'ContextMenu',
  'NumLock',
  'ScrollLock',
  'Pause',
  'PrintScreen',
]);

export function useKeyboardCapture(handlers: KeyboardCaptureHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // IME & dead key: jangan pernah diproses sebagai keystroke (dok. 03 §2).
      if (event.isComposing || event.key === 'Dead') return;

      // Shift+Insert adalah paste di banyak sistem — ikut diblokir (R-24).
      if (event.shiftKey && event.key === 'Insert') {
        event.preventDefault();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault(); // jangan memindahkan fokus
        handlers.onRestart();
        return;
      }

      if (event.key === 'Escape') {
        handlers.onExit();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault(); // jangan memicu "kembali" di browser lama
        handlers.onBackspace();
        return;
      }

      if (IGNORED.has(event.key) || event.key.startsWith('F')) {
        if (/^F\d{1,2}$/.test(event.key)) return;
        if (IGNORED.has(event.key)) return;
      }

      // Pintasan browser pengguna tetap hidup (Ctrl+T, Cmd+L, dst.).
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Enter') {
        handlers.onChar('\n', event);
        return;
      }

      if (event.key.length !== 1) return;

      // Space menggulung halaman kalau dibiarkan.
      if (event.key === ' ' && handlers.isActive()) event.preventDefault();

      handlers.onChar(event.key, event);
    };

    // Paste & drop diblokir seluruhnya di area sesi (dok. 03 §2, R-24).
    const block = (event: Event) => event.preventDefault();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('paste', block);
    document.addEventListener('drop', block);
    document.addEventListener('dragover', block);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('paste', block);
      document.removeEventListener('drop', block);
      document.removeEventListener('dragover', block);
    };
  }, [handlers, enabled]);
}
