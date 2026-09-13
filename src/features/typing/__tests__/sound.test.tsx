import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useTypingSession } from '../hooks/useTypingSession.ts';
import { _resetForTests, read, STORAGE_KEYS, write } from '@/lib/storage';

/**
 * Suara ketik opsional (Fase 8, ADR-035).
 *
 * Dua janji: modulnya **tidak dimuat** kalau suara mati (default), dan kalau
 * menyala tiap keystroke yang diterima berbunyi sekali — tanpa bunyi berbeda
 * untuk salah (dok. 01 prinsip 3).
 */
const click = vi.fn();
const createClicker = vi.fn(() => click);
vi.mock('@/lib/sound/keyClick.ts', () => ({ createClicker }));

function Harness() {
  useTypingSession({ target: 'ff jj', cols: 40, charWidth: 10, lineHeight: 20 });
  return null;
}

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
  click.mockClear();
  createClicker.mockClear();
});

describe('suara ketik (ADR-035)', () => {
  it('mati secara default: modul suara tidak pernah dibuat', async () => {
    render(<Harness />);
    await act(async () => {});
    press('f');
    press('x');
    expect(createClicker).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('menyala: satu bunyi per keystroke, benar maupun salah', async () => {
    write(STORAGE_KEYS.settings, { ...read(STORAGE_KEYS.settings), soundEnabled: true });
    render(<Harness />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    press('f');
    press('x');
    expect(createClicker).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledTimes(2);
  });
});
