import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { FingerCards } from '../components/FingerCards.tsx';
import { ALL_KEYS, FINGER_HOME, type Finger } from '../fingerMap.ts';
import { keyName } from '../describe.ts';

/**
 * Peta jari per tombol (ADR-038 poin 9–11). Yang dijaga: kartu tidak boleh
 * menyimpang dari `fingerMap.ts` — setiap tombol di tepat satu kartu, di jari yang benar.
 */
describe('FingerCards (ADR-038)', () => {
  const cards = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLElement>('.fc-card'),
  ];

  it('sembilan kartu, baris tengah: telunjuk kiri · jempol · telunjuk kanan', () => {
    const { container } = render(<FingerCards />);
    expect(cards(container).map((c) => c.dataset['finger'])).toEqual([
      'f1',
      'f2',
      'f3',
      'f4',
      'thumb',
      'f5',
      'f6',
      'f7',
      'f8',
    ]);
  });

  it('setiap tombol layout muncul sebagai chip di TEPAT satu kartu, kartu jarinya', () => {
    const { container } = render(<FingerCards />);
    const seen = new Map<string, string>();
    for (const card of cards(container)) {
      const finger = card.dataset['finger'] as Finger;
      const expected = ALL_KEYS.filter((k) => k.finger === finger).map((k) => keyName(k.id));
      const chips = [...card.querySelectorAll('.fc-chip')].map((c) => c.textContent ?? '');
      expect(chips, finger).toEqual(expected);
      for (const chip of chips) {
        expect(seen.has(chip), `${chip} ganda`).toBe(false);
        seen.set(chip, finger);
      }
    }
    expect(seen.size).toBe(ALL_KEYS.length);
  });

  it('keyboard mini mewarnai tombol milik jari itu saja, dan menandai tombol istirahatnya', () => {
    const { container } = render(<FingerCards />);
    for (const card of cards(container)) {
      const finger = card.dataset['finger'] as Finger;
      const own = [...card.querySelectorAll<SVGElement>('.fc-own')].map(
        (r) => r.dataset['key'],
      );
      expect(own.sort(), finger).toEqual(
        ALL_KEYS.filter((k) => k.finger === finger)
          .map((k) => k.id)
          .sort(),
      );
      const home = [...card.querySelectorAll<SVGElement>('.fc-home')].map(
        (r) => r.dataset['key'],
      );
      expect(home).toEqual([FINGER_HOME[finger]]);
    }
  });

  it('siluet pose jari di tombol istirahatnya tergambar setelah data pose tiba', async () => {
    const { container } = render(<FingerCards />);
    await waitFor(() => expect(container.querySelectorAll('.fc-hl')).toHaveLength(9));
    for (const path of container.querySelectorAll('.fc-hl')) {
      expect(path.getAttribute('d')).toMatch(/^m/);
    }
  });

  it('chip menampilkan tombolnya di keyboard interaktif', () => {
    const onPick = vi.fn();
    const { container } = render(<FingerCards onPick={onPick} />);
    const pinky = cards(container).find((c) => c.dataset['finger'] === 'f8')!;
    fireEvent.click(within(pinky).getByRole('button', { name: 'Backspace' }));
    expect(onPick).toHaveBeenCalledWith('Backspace');
    const index = cards(container).find((c) => c.dataset['finger'] === 'f5')!;
    expect(within(index).getByRole('button', { name: 'J, tempat istirahat' })).toBeTruthy();
  });
});
