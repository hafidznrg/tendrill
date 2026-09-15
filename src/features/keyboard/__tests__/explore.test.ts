import { describe, expect, it } from 'vitest';
import { ALL_KEYS, hintFor, hintForKey, keyIdFromCode } from '../fingerMap.ts';
import { describeHint, keyName } from '../describe.ts';
import { hintFromKeyEvent } from '../useKeyExplorer.ts';

/** `KeyboardEvent.code` untuk tiap tombol layout — ditulis tangan, bukan diturunkan dari kode yang diuji. */
const CODES: Record<string, string> = {
  '`': 'Backquote',
  '1': 'Digit1',
  '2': 'Digit2',
  '3': 'Digit3',
  '4': 'Digit4',
  '5': 'Digit5',
  '6': 'Digit6',
  '7': 'Digit7',
  '8': 'Digit8',
  '9': 'Digit9',
  '0': 'Digit0',
  '-': 'Minus',
  '=': 'Equal',
  Backspace: 'Backspace',
  Tab: 'Tab',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  CapsLock: 'CapsLock',
  ';': 'Semicolon',
  "'": 'Quote',
  Enter: 'Enter',
  ShiftLeft: 'ShiftLeft',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ShiftRight: 'ShiftRight',
  Space: 'Space',
};
const codeOf = (id: string) => CODES[id] ?? `Key${id.toUpperCase()}`;

describe('pemetaan tombol fisik (ADR-038)', () => {
  it('setiap tombol layout bisa dicapai dari KeyboardEvent.code', () => {
    for (const key of ALL_KEYS) expect(keyIdFromCode(codeOf(key.id)), key.id).toBe(key.id);
  });

  it('tombol di luar layout → null', () => {
    for (const code of ['F1', 'ArrowUp', 'Numpad5', 'AltLeft', 'KeyAB', 'Digit10']) {
      expect(keyIdFromCode(code)).toBeNull();
    }
  });

  it('setiap tombol punya hint dengan jarinya sendiri, tanpa Shift', () => {
    for (const key of ALL_KEYS) {
      expect(hintForKey(key.id)).toEqual({
        keyId: key.id,
        shiftKeyId: null,
        finger: key.finger,
      });
    }
  });
});

describe('keterangan tombol (ADR-038)', () => {
  it('tombol jangkauan menyebut jari dan tempat istirahatnya', () => {
    expect(describeHint(hintFor('e')!)).toEqual({
      key: 'E',
      finger: 'tengah kiri',
      from: 'D',
      shift: null,
    });
    expect(describeHint(hintForKey('Backspace')!)).toMatchObject({
      key: 'Backspace',
      finger: 'kelingking kanan',
      from: ';',
    });
  });

  it('h dijangkau dari J; j sendiri tempat istirahat (kegagalan uji pemula)', () => {
    expect(describeHint(hintFor('h')!).from).toBe('J');
    expect(describeHint(hintFor('j')!).from).toBeNull();
  });

  it('Shift menyebut Shift sisi berlawanan beserta jarinya', () => {
    expect(describeHint(hintFor('J')!).shift).toEqual({
      key: 'Shift kiri',
      finger: 'kelingking kiri',
    });
  });

  it('spasi tidak punya asal jangkauan', () => {
    expect(describeHint(hintForKey('Space')!).from).toBeNull();
    expect(keyName('Space')).toBe('Spasi');
  });
});

describe('penyaring keyboard fisik (ADR-038)', () => {
  const ev = (code: string, init: KeyboardEventInit = {}, target?: HTMLElement) => {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, ...init });
    if (target) Object.defineProperty(event, 'target', { value: target });
    return event;
  };

  it('huruf, tombol non-karakter, dan Shift + huruf', () => {
    expect(hintFromKeyEvent(ev('KeyE'))?.keyId).toBe('e');
    expect(hintFromKeyEvent(ev('Backspace'))?.keyId).toBe('Backspace');
    expect(hintFromKeyEvent(ev('KeyJ', { shiftKey: true }))).toEqual(hintFor('J'));
  });

  it('code kosong (keyboard virtual/remote desktop) jatuh ke key', () => {
    expect(hintFromKeyEvent(ev('', { key: 'k' }))?.keyId).toBe('k');
    expect(hintFromKeyEvent(ev('', { key: 'K' }))).toEqual(hintFor('K'));
    expect(hintFromKeyEvent(ev('', { key: 'q', shiftKey: true }))).toEqual(hintFor('Q'));
    expect(hintFromKeyEvent(ev('', { key: ' ' }))?.keyId).toBe('Space');
    expect(hintFromKeyEvent(ev('', { key: 'Backspace' }))?.keyId).toBe('Backspace');
    expect(hintFromKeyEvent(ev('', { key: 'Tab' }))).toBeNull();
    expect(hintFromKeyEvent(ev('', { key: 'Enter' }))).toBeNull();
    expect(hintFromKeyEvent(ev('', { key: 'ArrowUp' }))).toBeNull();
  });

  it('Tab, Enter, dan kombinasi Ctrl/Alt/Meta tidak pernah ditangkap', () => {
    expect(hintFromKeyEvent(ev('Tab'))).toBeNull();
    expect(hintFromKeyEvent(ev('Enter'))).toBeNull();
    expect(hintFromKeyEvent(ev('KeyC', { ctrlKey: true }))).toBeNull();
    expect(hintFromKeyEvent(ev('KeyC', { metaKey: true }))).toBeNull();
    expect(hintFromKeyEvent(ev('KeyC', { altKey: true }))).toBeNull();
  });

  it('isian teks dilepas seluruhnya; tombol hanya melepas Spasi', () => {
    const input = document.createElement('input');
    expect(hintFromKeyEvent(ev('KeyE', {}, input))).toBeNull();
    const button = document.createElement('button');
    expect(hintFromKeyEvent(ev('Space', {}, button))).toBeNull();
    // Kontrol negatif: huruf tetap ditangkap walau fokus di tombol "lihat bedanya".
    expect(hintFromKeyEvent(ev('KeyE', {}, button))?.keyId).toBe('e');
  });
});
