import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { TypingStage } from '../components/TypingStage.tsx';
import { STORAGE_KEYS, read, write } from '@/lib/storage';

/**
 * Mode fokus (ADR-044): atribut `data-focus` di `<html>` hanya selama `running`,
 * hanya kalau pengaturannya nyala, dan footer tetap di DOM (memudar, bukan dilepas).
 */

vi.mock('@/features/typing/hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, width: 520, ready: true }),
}));

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function setFocusMode(on: boolean): void {
  write(STORAGE_KEYS.settings, { ...read(STORAGE_KEYS.settings), focusMode: on });
}

function stage() {
  return render(
    <TypingStage
      target="ff jj"
      title="uji"
      onFinish={() => {}}
      footer={<p data-testid="hint">petunjuk</p>}
    />,
  );
}

describe('mode fokus (ADR-044)', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['focus'];
  });

  it('nyala hanya sesudah keystroke pertama, padam saat selesai', () => {
    setFocusMode(true);
    const { getByTestId } = stage();
    expect(document.documentElement.dataset['focus']).toBeUndefined();

    press('f');
    expect(document.documentElement.dataset['focus']).toBe('on');
    // Memudar, tidak dilepas: footer tetap di DOM di dalam pembungkusnya.
    expect(getByTestId('hint').parentElement?.className).toBe('stage-footer');

    for (const k of 'f jj') press(k);
    expect(document.documentElement.dataset['focus']).toBeUndefined();
  });

  it('dilepas saat unmount, supaya rute lain tidak mewarisi header tak terlihat', () => {
    setFocusMode(true);
    const { unmount } = stage();
    press('f');
    unmount();
    expect(document.documentElement.dataset['focus']).toBeUndefined();
  });

  it('kontrol negatif: pengaturan mati → atribut tidak pernah ditulis', () => {
    stage();
    press('f');
    expect(document.documentElement.dataset['focus']).toBeUndefined();
  });
});
