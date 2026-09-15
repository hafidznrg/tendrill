import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { VirtualKeyboard } from '../components/VirtualKeyboard.tsx';
import { hintForKey, type KeyHint } from '../fingerMap.ts';

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

/**
 * Siluet tangan (ADR-036, ADR-037). jsdom tidak punya layout, jadi yang dibuktikan
 * di sini hanya bahwa pose dan panah yang BENAR tertulis. Letaknya di atas tombol
 * dijaga `hands.test.ts`; apakah terlihat pas dinilai pemilik.
 */
describe('VirtualKeyboard — siluet tangan (ADR-036, ADR-037)', () => {
  async function setupHands(showHands = true) {
    let paint!: (char: string | null) => void;
    const { container } = render(
      <VirtualKeyboard onReady={(p) => (paint = p)} showHands={showHands} />,
    );
    const svg = () => container.querySelector('svg.vk-hands');
    // Data pose dimuat lewat import() dinamis.
    if (showHands)
      await waitFor(() =>
        expect(
          container.querySelector('[data-hand="left"]')?.getAttribute('data-pose'),
        ).toBeTruthy(),
      );
    const reach = (slot: 'a' | 'b') =>
      container.querySelector(`[data-reach="${slot}"]`)?.getAttribute('d') ?? '';
    const pose = (side: 'left' | 'right') =>
      container.querySelector(`[data-hand="${side}"]`)?.getAttribute('data-pose');
    const skin = (side: 'left' | 'right') =>
      container.querySelector(`[data-hand="${side}"] .vk-skin`)?.getAttribute('d') ?? '';
    return {
      paint: (c: string | null) => act(() => paint(c)),
      svg,
      reach,
      pose,
      skin,
      container,
    };
  }

  it('tidak ada siluet kalau tidak diminta', async () => {
    const { svg } = await setupHands(false);
    expect(svg()).toBeNull();
  });

  it('dua tangan beristirahat sebelum ada karakter, sudah bergambar', async () => {
    const { pose, skin, container } = await setupHands();
    expect(pose('left')).toBe('rest-left');
    expect(pose('right')).toBe('rest-right');
    expect(skin('left')).toMatch(/^m/);
    expect(container.querySelector('.vk-hands > g > g')?.getAttribute('transform')).toMatch(
      /^matrix\(/,
    );
  });

  it('tombol istirahat: tangan berpose, tanpa panah', async () => {
    const { paint, pose, reach } = await setupHands();
    paint('s');
    expect(pose('left')).toBe('s');
    expect(pose('right')).toBe('rest-right');
    expect(reach('a')).toBe('');
  });

  it('tombol jangkauan: pose tombolnya DAN panah digambar', async () => {
    const { paint, pose, skin, reach } = await setupHands();
    const rest = skin('left');
    paint('e');
    expect(pose('left')).toBe('e');
    expect(skin('left')).not.toBe(rest);
    expect(reach('a')).toMatch(/^M/);
    // h dan j satu jari, tapi hanya h yang butuh jangkauan.
    paint('h');
    expect(pose('right')).toBe('h');
    expect(pose('left')).toBe('rest-left');
    expect(reach('a')).toMatch(/^M/);
    paint('j');
    expect(reach('a')).toBe('');
  });

  it('Shift: tangan sisi berlawanan memakai pose Shift, dengan panahnya', async () => {
    const { paint, pose, reach } = await setupHands();
    paint('J');
    expect(pose('right')).toBe('j');
    expect(pose('left')).toBe('ShiftLeft');
    expect(reach('b')).toMatch(/^M/);
    paint('k');
    expect(pose('left')).toBe('rest-left');
    expect(reach('b')).toBe('');
  });

  it('spasi = jempol kanan; null mengistirahatkan semuanya', async () => {
    const { paint, pose, reach } = await setupHands();
    paint(' ');
    expect(pose('right')).toBe('Space');
    expect(reach('a')).toBe('');
    paint('r');
    paint(null);
    expect(pose('left')).toBe('rest-left');
    expect(pose('right')).toBe('rest-right');
    expect(reach('a')).toBe('');
  });

  it('pose yang tidak berganti tidak ditulis ulang', async () => {
    const { paint, container } = await setupHands();
    paint('f');
    const right = container.querySelector('[data-hand="right"] .vk-skin')!;
    const spy = vi.spyOn(right, 'setAttribute');
    paint('d');
    paint('s');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('VirtualKeyboard — pelukis hint (ADR-038)', () => {
  it('melukis tombol non-karakter, dan paint(char) sesudahnya tetap melukis ulang', () => {
    let paint!: (char: string | null) => void;
    let paintHint!: (hint: KeyHint | null) => void;
    const { container } = render(
      <VirtualKeyboard
        onReady={(p, h) => {
          paint = p;
          paintHint = h;
        }}
      />,
    );
    const lit = () =>
      [...container.querySelectorAll('.vk-next')].map(
        (el) => (el as HTMLElement).dataset['key'],
      );
    act(() => paint('f'));
    act(() => paintHint(hintForKey('Tab')));
    expect(lit()).toEqual(['Tab']);
    // Cache karakter wajib batal: tanpa itu 'f' dianggap sudah terlukis dan Tab tertinggal.
    act(() => paint('f'));
    expect(lit()).toEqual(['f']);
  });
});
