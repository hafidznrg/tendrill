import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { act } from 'react';
import { VirtualKeyboard } from '../components/VirtualKeyboard.tsx';

/**
 * Uji komponen terbatas (dok. 09 §6): virtual keyboard menyorot tombol yang
 * benar, **termasuk Shift sisi berlawanan** — itulah kebiasaan yang mau
 * diajarkan, dan satu-satunya bagian keyboard ini yang punya logika.
 */

function setup() {
  let paint!: (char: string | null) => void;
  const { container } = render(<VirtualKeyboard onReady={(p) => (paint = p)} />);
  const lit = () =>
    [...container.querySelectorAll('.vk-next')].map((el) => (el as HTMLElement).dataset['key']);
  return { paint: (c: string | null) => act(() => paint(c)), lit, container };
}

describe('VirtualKeyboard (dok. 09 §6)', () => {
  it('menyorot satu tombol untuk karakter tanpa Shift', () => {
    const { paint, lit } = setup();
    paint('f');
    expect(lit()).toEqual(['f']);
  });

  it('menyorot huruf DAN Shift sisi berlawanan', () => {
    const { paint, lit } = setup();

    paint('A'); // 'a' di tangan kiri → Shift kanan
    expect(lit()!.sort()).toEqual(['ShiftRight', 'a']);

    paint('L'); // 'l' di tangan kanan → Shift kiri
    expect(lit()!.sort()).toEqual(['ShiftLeft', 'l']);
  });

  it('sorotan lama dimatikan sebelum yang baru dinyalakan', () => {
    const { paint, lit } = setup();
    paint('A');
    expect(lit()).toHaveLength(2);
    paint('f');
    expect(lit()).toEqual(['f']);
  });

  it('null mematikan seluruh sorotan (sesi selesai)', () => {
    const { paint, lit } = setup();
    paint('f');
    paint(null);
    expect(lit()).toEqual([]);
  });

  it('karakter di luar layout tidak menyorot apa pun dan tidak melempar', () => {
    const { paint, lit } = setup();
    expect(() => paint('é')).not.toThrow();
    expect(lit()).toEqual([]);
  });

  it('dekoratif bagi screen reader (dok. 07 §8)', () => {
    const { container } = setup();
    expect(container.querySelector('.vk-root')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('setiap tombol membawa jarinya, untuk pewarnaan panduan jari', () => {
    const { container } = setup();
    const f = container.querySelector('[data-key="f"]') as HTMLElement;
    const j = container.querySelector('[data-key="j"]') as HTMLElement;
    expect(f.dataset['finger']).toBe('f4');
    expect(j.dataset['finger']).toBe('f5');
  });
});
