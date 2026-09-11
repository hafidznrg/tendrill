import { useEffect, useRef } from 'react';
import { hintFor, KEYBOARD_ROWS, type KeyDef, type KeyHint } from '../fingerMap.ts';
import './virtual-keyboard.css';

/**
 * Virtual keyboard dengan panduan jari (dok. 07 §4).
 *
 * ⚠️ Seperti `TypingArea`, sorotan tombol berikutnya diperbarui **imperatif**:
 * satu penulisan `className` pada satu tombol, bukan render ulang seluruh
 * keyboard. Keyboard ini punya ~60 tombol dan diperbarui tiap keystroke —
 * merendernya ulang lewat React akan membatalkan seluruh kerja dok. 03 §7.
 *
 * `aria-hidden` karena ia murni dekoratif: seluruh informasinya sudah ada di
 * teks target, dan membacakan 60 tombol ke screen reader tidak menolong siapa pun
 * (dok. 07 §8).
 */

export interface VirtualKeyboardProps {
  /** Dipanggil dengan fungsi pelukis; pemanggil menyimpannya untuk jalur keystroke. */
  onReady: (paint: (char: string | null) => void) => void;
  showFingerColors?: boolean;
}

/**
 * `hintFor` di-cache: jalur keystroke tidak boleh menghitung ulang peta karakter,
 * dan jumlah karakter berbeda dalam satu sesi selalu kecil.
 */
const hintCache = new Map<string, KeyHint | null>();
function hintForCached(char: string): KeyHint | null {
  let hit = hintCache.get(char);
  if (hit === undefined) {
    hit = hintFor(char);
    hintCache.set(char, hit);
  }
  return hit;
}

export function VirtualKeyboard({ onReady, showFingerColors = true }: VirtualKeyboardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const keyEls = new Map<string, HTMLElement>();
    for (const el of host.querySelectorAll<HTMLElement>('[data-key]')) {
      keyEls.set(el.dataset['key']!, el);
    }

    let lit: HTMLElement[] = [];
    let litFor: string | null = null;

    // Pelukis: matikan sorotan lama, nyalakan yang baru. Maksimal 2 tombol
    // (huruf + Shift sisi berlawanan), jadi maksimal 4 penulisan className.
    const paint = (char: string | null) => {
      // Karakter berulang tidak perlu dicat ulang. Drill Unit 1 penuh dengan
      // 'ff jj ff jj', jadi ini menghapus separuh penulisan DOM di sana.
      if (char === litFor) return;
      litFor = char;

      for (const el of lit) el.classList.remove('vk-next');
      lit = [];
      if (char === null) return;

      const hint = hintForCached(char);
      if (!hint) return;

      const keyEl = keyEls.get(hint.keyId);
      if (keyEl) {
        keyEl.classList.add('vk-next');
        lit.push(keyEl);
      }
      if (hint.shiftKeyId) {
        const shiftEl = keyEls.get(hint.shiftKeyId);
        if (shiftEl) {
          shiftEl.classList.add('vk-next');
          lit.push(shiftEl);
        }
      }
    };

    onReady(paint);
    return () => onReady(() => {});
  }, [onReady]);

  return (
    <div
      className={`vk-root${showFingerColors ? '' : ' vk-mono'}`}
      ref={hostRef}
      aria-hidden="true"
    >
      {KEYBOARD_ROWS.map((row, i) => (
        <div className="vk-row" key={i}>
          {row.map((key) => (
            <Keycap key={key.id} def={key} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Keycap({ def }: { def: KeyDef }) {
  return (
    <span
      data-key={def.id}
      data-finger={def.finger}
      className={`vk-key${def.home ? ' vk-home' : ''}`}
      style={{ flexGrow: def.width ?? 1, flexBasis: `${(def.width ?? 1) * 2.2}rem` }}
    >
      {def.label}
    </span>
  );
}
