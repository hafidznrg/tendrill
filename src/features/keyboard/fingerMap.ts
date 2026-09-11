/**
 * Layout QWERTY dan pemetaan jari (dok. 07 §4).
 *
 * Dua hal sengaja dipisah sejak awal (dok. 03 §2):
 * - `code` (posisi fisik tombol) untuk MENAMPILKAN tombol di virtual keyboard.
 * - `key` (karakter hasil, sudah memperhitungkan Shift) untuk MEMBANDINGKAN
 *   dengan teks target.
 *
 * Selama pemisahan itu dijaga, dukungan Dvorak/Colemak nanti hanya perlu
 * mengganti tabel di file ini — bukan menyentuh engine sama sekali.
 */

export type Finger = 'f1' | 'f2' | 'f3' | 'f4' | 'thumb' | 'f5' | 'f6' | 'f7' | 'f8';

export const FINGER_LABEL: Record<Finger, string> = {
  f1: 'kelingking kiri',
  f2: 'manis kiri',
  f3: 'tengah kiri',
  f4: 'telunjuk kiri',
  thumb: 'jempol',
  f5: 'telunjuk kanan',
  f6: 'tengah kanan',
  f7: 'manis kanan',
  f8: 'kelingking kanan',
};

/** Sisi tangan — menentukan Shift mana yang disorot (dok. 07 §4). */
export function handOf(finger: Finger): 'left' | 'right' | 'thumb' {
  if (finger === 'thumb') return 'thumb';
  return finger === 'f1' || finger === 'f2' || finger === 'f3' || finger === 'f4'
    ? 'left'
    : 'right';
}

export interface KeyDef {
  /** Identitas tombol fisik. Untuk huruf = karakter kecilnya. */
  id: string;
  /** Karakter tanpa Shift. null untuk tombol non-karakter. */
  lower: string | null;
  /** Karakter dengan Shift. null kalau tidak menghasilkan karakter. */
  upper: string | null;
  /** Teks yang ditampilkan di keycap. */
  label: string;
  finger: Finger;
  /** Lebar relatif terhadap tombol huruf (1 = satu satuan). */
  width?: number;
  /** Tombol home row — diberi penanda taktil seperti keyboard sungguhan. */
  home?: boolean;
}

function k(lower: string, upper: string, finger: Finger, extra: Partial<KeyDef> = {}): KeyDef {
  return { id: lower, lower, upper, label: lower, finger, ...extra };
}

function special(id: string, label: string, finger: Finger, width: number): KeyDef {
  return { id, lower: null, upper: null, label, finger, width };
}

/**
 * Baris keyboard. Pemetaan jari mengikuti dok. 07 §4 persis — kalau tabel di
 * sana berubah, file ini ikut berubah, bukan sebaliknya.
 */
export const KEYBOARD_ROWS: KeyDef[][] = [
  [
    k('`', '~', 'f1'),
    k('1', '!', 'f1'),
    k('2', '@', 'f2'),
    k('3', '#', 'f3'),
    k('4', '$', 'f4'),
    k('5', '%', 'f4'),
    k('6', '^', 'f5'),
    k('7', '&', 'f5'),
    k('8', '*', 'f6'),
    k('9', '(', 'f7'),
    k('0', ')', 'f8'),
    k('-', '_', 'f8'),
    k('=', '+', 'f8'),
    special('Backspace', 'Bksp', 'f8', 2),
  ],
  [
    special('Tab', 'Tab', 'f1', 1.5),
    k('q', 'Q', 'f1'),
    k('w', 'W', 'f2'),
    k('e', 'E', 'f3'),
    k('r', 'R', 'f4'),
    k('t', 'T', 'f4'),
    k('y', 'Y', 'f5'),
    k('u', 'U', 'f5'),
    k('i', 'I', 'f6'),
    k('o', 'O', 'f7'),
    k('p', 'P', 'f8'),
    k('[', '{', 'f8'),
    k(']', '}', 'f8'),
    k('\\', '|', 'f8', { width: 1.5 }),
  ],
  [
    special('CapsLock', 'Caps', 'f1', 1.75),
    k('a', 'A', 'f1', { home: true }),
    k('s', 'S', 'f2', { home: true }),
    k('d', 'D', 'f3', { home: true }),
    k('f', 'F', 'f4', { home: true }),
    k('g', 'G', 'f4'),
    k('h', 'H', 'f5'),
    k('j', 'J', 'f5', { home: true }),
    k('k', 'K', 'f6', { home: true }),
    k('l', 'L', 'f7', { home: true }),
    k(';', ':', 'f8', { home: true }),
    k("'", '"', 'f8'),
    special('Enter', 'Enter', 'f8', 2.25),
  ],
  [
    special('ShiftLeft', 'Shift', 'f1', 2.25),
    k('z', 'Z', 'f1'),
    k('x', 'X', 'f2'),
    k('c', 'C', 'f3'),
    k('v', 'V', 'f4'),
    k('b', 'B', 'f4'),
    k('n', 'N', 'f5'),
    k('m', 'M', 'f5'),
    k(',', '<', 'f6'),
    k('.', '>', 'f7'),
    k('/', '?', 'f8'),
    special('ShiftRight', 'Shift', 'f8', 2.75),
  ],
  [{ id: 'Space', lower: ' ', upper: ' ', label: '', finger: 'thumb', width: 10 }],
];

export const ALL_KEYS: KeyDef[] = KEYBOARD_ROWS.flat();

/** Karakter → tombol fisik yang menghasilkannya, dan apakah butuh Shift. */
interface CharTarget {
  keyId: string;
  needsShift: boolean;
  finger: Finger;
}

const CHAR_INDEX = new Map<string, CharTarget>();
for (const key of ALL_KEYS) {
  if (key.lower !== null && !CHAR_INDEX.has(key.lower)) {
    CHAR_INDEX.set(key.lower, { keyId: key.id, needsShift: false, finger: key.finger });
  }
  if (key.upper !== null && key.upper !== key.lower && !CHAR_INDEX.has(key.upper)) {
    CHAR_INDEX.set(key.upper, { keyId: key.id, needsShift: true, finger: key.finger });
  }
}
// Enter mengetik baris baru; ia tidak punya `lower` sebagai karakter biasa.
CHAR_INDEX.set('\n', { keyId: 'Enter', needsShift: false, finger: 'f8' });

/** Jari yang bertanggung jawab atas sebuah karakter. */
export function fingerFor(char: string): Finger | null {
  return CHAR_INDEX.get(char)?.finger ?? null;
}

export interface KeyHint {
  /** Tombol huruf yang harus ditekan. */
  keyId: string;
  /**
   * Shift di sisi BERLAWANAN dari huruf — ini yang mengajarkan kebiasaan Shift
   * yang benar sejak awal (dok. 07 §4). Null kalau karakter tidak butuh Shift.
   */
  shiftKeyId: 'ShiftLeft' | 'ShiftRight' | null;
  finger: Finger;
}

/** Tombol mana yang harus disorot untuk mengetik `char`. */
export function hintFor(char: string): KeyHint | null {
  const target = CHAR_INDEX.get(char);
  if (!target) return null;

  let shiftKeyId: KeyHint['shiftKeyId'] = null;
  if (target.needsShift) {
    // Huruf di tangan kiri → Shift kanan, dan sebaliknya.
    shiftKeyId = handOf(target.finger) === 'left' ? 'ShiftRight' : 'ShiftLeft';
  }

  return { keyId: target.keyId, shiftKeyId, finger: target.finger };
}
