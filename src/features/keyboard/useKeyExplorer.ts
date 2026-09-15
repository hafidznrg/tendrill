import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { hintFor, hintForKey, keyById, keyIdFromCode, type KeyHint } from './fingerMap.ts';

/**
 * Menjelajah posisi jari per tombol di `/posture` (ADR-038): keyboard fisik + hover.
 *
 * Sengaja HOOK, bukan mode di `VirtualKeyboard`: layar sesi tidak pernah memasangnya,
 * jadi tidak ada listener baru di jalur keystroke sesi. Keduanya bermuara ke pelukis
 * berbasis hint yang diserahkan `VirtualKeyboard` lewat argumen kedua `onReady`.
 *
 * `/posture` bukan layar sesi, jadi keterangan boleh memakai state React (ADR-038
 * poin 7). Pelukis tangan tetap imperatif.
 */

export type PaintHint = (hint: KeyHint | null) => void;

/** Id tombol yang aksi bawaannya mengganggu halaman saat ditangkap. */
const PREVENT = new Set(['Space', 'Backspace', "'", '/']);

function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

function isActivatable(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && el.closest('button, a[href], summary') !== null;
}

/**
 * Hint dari event keyboard fisik; null kalau event ini bukan urusan penjelajah.
 *
 * Utamanya dari `code` (posisi fisik). Keyboard virtual OS, remote desktop, dan
 * sebagian IME mengirim `code` KOSONG — untuk itu jatuh ke `key` (karakter), yang
 * sudah memperhitungkan Shift sendiri.
 */
export function hintFromKeyEvent(event: KeyboardEvent): KeyHint | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  if (event.key === 'Tab' || event.key === 'Enter' || event.code === 'Tab') return null;
  if (event.code === 'Enter' || event.code === 'NumpadEnter') return null;
  if (isTextField(event.target)) return null;
  const isSpace = event.code === 'Space' || (!event.code && event.key === ' ');
  // Spasi di tombol/tautan menekannya — itu milik tombol, bukan penjelajah.
  if (isSpace && isActivatable(event.target)) return null;

  if (!event.code) {
    if (isSpace) return hintForKey('Space');
    const byKey = keyById(event.key);
    // `shiftKey` dengan `key` huruf kecil (sebagian keyboard virtual): hormati Shift-nya.
    if (event.shiftKey && byKey?.upper && byKey.upper !== byKey.lower)
      return hintFor(byKey.upper);
    return hintForKey(event.key) ?? hintFor(event.key);
  }
  const keyId = keyIdFromCode(event.code);
  if (!keyId) return null;
  const key = keyById(keyId);
  // Shift ditahan + tombol berkarakter = pose dua tangan, persis seperti mengetik.
  if (event.shiftKey && key?.upper && key.upper !== key.lower) return hintFor(key.upper);
  return hintForKey(keyId);
}

export interface KeyExplorer {
  /** Tombol yang sedang ditampilkan; null = posisi istirahat. */
  hint: KeyHint | null;
  /** Dipasang di pembungkus keyboard. */
  pointerHandlers: {
    onPointerOver: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: () => void;
  };
  /** Tampilkan tombol tertentu — dipakai tautan "lihat bedanya". */
  show: (hint: KeyHint | null) => void;
}

export function useKeyExplorer(paintRef: { readonly current: PaintHint | null }): KeyExplorer {
  const [hint, setHint] = useState<KeyHint | null>(null);
  /** Pilihan "tetap" (keyboard fisik / tautan) — tempat kembali saat kursor pergi. */
  const pinnedRef = useRef<KeyHint | null>(null);
  const hoverRef = useRef<string | null>(null);

  const apply = useCallback(
    (next: KeyHint | null) => {
      paintRef.current?.(next);
      setHint(next);
    },
    [paintRef],
  );

  const show = useCallback(
    (next: KeyHint | null) => {
      pinnedRef.current = next;
      hoverRef.current = null;
      apply(next);
    },
    [apply],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const next = hintFromKeyEvent(event);
      if (!next) return;
      if (PREVENT.has(next.keyId)) event.preventDefault();
      if (event.repeat) return;
      show(next);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [show]);

  const onPointerOver = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const el = (event.target as HTMLElement).closest<HTMLElement>('[data-key]');
      const keyId = el?.dataset['key'];
      if (!keyId || keyId === hoverRef.current) return;
      hoverRef.current = keyId;
      apply(hintForKey(keyId));
    },
    [apply],
  );

  const onPointerLeave = useCallback(() => {
    if (hoverRef.current === null) return;
    hoverRef.current = null;
    apply(pinnedRef.current);
  }, [apply]);

  return { hint, pointerHandlers: { onPointerOver, onPointerLeave }, show };
}
