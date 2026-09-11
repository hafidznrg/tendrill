import { describe, expect, it } from 'vitest';
import { ALL_KEYS, fingerFor, handOf, hintFor, KEYBOARD_ROWS } from '../fingerMap.ts';

/**
 * Peta jari (dok. 07 §4). Diuji ketat karena ia menopang dua hal sekaligus:
 * sorotan virtual keyboard DAN kalimat diagnosis. Salah di sini berarti
 * mengajarkan kebiasaan jari yang keliru — kerusakan yang baru terasa
 * berbulan-bulan kemudian.
 */

describe('layout QWERTY', () => {
  it('id tombol unik', () => {
    const ids = ALL_KEYS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('home row memuat delapan tombol yang benar', () => {
    const home = ALL_KEYS.filter((k) => k.home).map((k) => k.id);
    expect(home).toEqual(['a', 's', 'd', 'f', 'j', 'k', 'l', ';']);
  });

  it('setiap huruf a–z ada di keyboard', () => {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      expect(fingerFor(ch), `huruf ${ch}`).not.toBeNull();
    }
  });

  it('lima baris, dan baris spasi hanya berisi Space', () => {
    expect(KEYBOARD_ROWS).toHaveLength(5);
    expect(KEYBOARD_ROWS[4]!.map((k) => k.id)).toEqual(['Space']);
  });
});

describe('pemetaan jari mengikuti dok. 07 §4', () => {
  // Tabel ini disalin langsung dari dokumen — kalau dokumennya berubah,
  // test ini yang pertama merah, dan itu memang tujuannya.
  const EXPECTED: Array<[string, string]> = [
    ['`1qaz', 'f1'],
    ['2wsx', 'f2'],
    ['3edc', 'f3'],
    ['45rtfgvb', 'f4'],
    [' ', 'thumb'],
    ['67yuhjnm', 'f5'],
    ['8ik,', 'f6'],
    ['9ol.', 'f7'],
    ["0-=p[]\\;'/", 'f8'],
  ];

  for (const [chars, finger] of EXPECTED) {
    it(`${finger} memegang ${chars.trim() || 'spasi'}`, () => {
      for (const ch of chars) {
        expect(fingerFor(ch), `karakter "${ch}"`).toBe(finger);
      }
    });
  }

  it('handOf membagi kiri/kanan dengan benar', () => {
    expect(handOf('f1')).toBe('left');
    expect(handOf('f4')).toBe('left');
    expect(handOf('f5')).toBe('right');
    expect(handOf('f8')).toBe('right');
    expect(handOf('thumb')).toBe('thumb');
  });
});

describe('hintFor — Shift sisi berlawanan (dok. 07 §4)', () => {
  it('huruf kecil tidak butuh Shift', () => {
    expect(hintFor('a')).toEqual({ keyId: 'a', shiftKeyId: null, finger: 'f1' });
  });

  it('huruf kapital di tangan KIRI memakai Shift KANAN', () => {
    const hint = hintFor('A');
    expect(hint).toEqual({ keyId: 'a', shiftKeyId: 'ShiftRight', finger: 'f1' });
  });

  it('huruf kapital di tangan KANAN memakai Shift KIRI', () => {
    expect(hintFor('L')).toEqual({ keyId: 'l', shiftKeyId: 'ShiftLeft', finger: 'f7' });
  });

  it('simbol ber-Shift ikut aturan yang sama', () => {
    // '?' ada di tombol '/' (kelingking kanan) → Shift kiri.
    expect(hintFor('?')).toEqual({ keyId: '/', shiftKeyId: 'ShiftLeft', finger: 'f8' });
    // '!' ada di tombol '1' (kelingking kiri) → Shift kanan.
    expect(hintFor('!')).toEqual({ keyId: '1', shiftKeyId: 'ShiftRight', finger: 'f1' });
  });

  it('spasi memakai jempol dan tanpa Shift', () => {
    expect(hintFor(' ')).toEqual({ keyId: 'Space', shiftKeyId: null, finger: 'thumb' });
  });

  it('karakter di luar layout mengembalikan null, bukan melempar', () => {
    expect(hintFor('é')).toBeNull();
    expect(fingerFor('é')).toBeNull();
  });
});
