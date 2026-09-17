import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { TypingStage } from '../components/TypingStage.tsx';
import { exportAll, importAll } from '@/lib/storage';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Mode fokus (ADR-044/045) dan sembunyikan keyboard (ADR-045).
 *
 * Mode fokus: CSS memudarkan hanya kalau `data-focus-mode` (sakelar bilah atas)
 * DAN `data-session="running"` (panggung) sama-sama ada. Panggung tidak membaca
 * pengaturan, jadi sakelar yang ditekan di tengah halaman langsung berlaku.
 */

vi.mock('@/features/typing/hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, width: 520, ready: true }),
}));

const root = document.documentElement;

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function stage(props: { showKeyboard?: boolean } = {}) {
  return render(
    <TypingStage
      target="ff jj"
      title="uji"
      onFinish={() => {}}
      footer={<p data-testid="hint">petunjuk</p>}
      {...props}
    />,
  );
}

describe('mode fokus (ADR-044/045)', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useSettingsStore.getState().setFocusMode(false));
    delete root.dataset['session'];
  });

  it('panggung mengumumkan running hanya sesudah keystroke pertama, lalu padam saat selesai', () => {
    const { getByTestId } = stage();
    expect(root.dataset['session']).toBeUndefined();

    press('f');
    expect(root.dataset['session']).toBe('running');
    // Memudar, tidak dilepas: footer tetap di DOM di dalam pembungkusnya.
    expect(getByTestId('hint').parentElement?.className).toBe('stage-footer');

    for (const k of 'f jj') press(k);
    expect(root.dataset['session']).toBeUndefined();
  });

  it('dilepas saat unmount, supaya rute lain tidak mewarisi header tak terlihat', () => {
    const { unmount } = stage();
    press('f');
    unmount();
    expect(root.dataset['session']).toBeUndefined();
  });

  it('sakelar menulis data-focus-mode dan key sendiri, bukan typing:settings', () => {
    act(() => useSettingsStore.getState().toggleFocusMode());
    expect(root.dataset['focusMode']).toBe('on');
    expect(localStorage.getItem('tendrill.focus')).toBe('on');
    expect(localStorage.getItem('typing:settings')).toBeNull();

    act(() => useSettingsStore.getState().toggleFocusMode());
    // Kontrol negatif: mati berarti atribut gerbang CSS hilang.
    expect(root.dataset['focusMode']).toBeUndefined();
    expect(localStorage.getItem('tendrill.focus')).toBeNull();
  });

  it('dicerminkan ke settings.focusMode saat ekspor dan dipulihkan saat impor', () => {
    act(() => useSettingsStore.getState().setFocusMode(true));
    const dump = exportAll();
    expect(JSON.parse(dump).data.settings.focusMode).toBe(true);

    localStorage.removeItem('tendrill.focus');
    expect(importAll(dump).ok).toBe(true);
    expect(localStorage.getItem('tendrill.focus')).toBe('on');
  });
});

describe('sembunyikan keyboard (ADR-045)', () => {
  it('pembungkus keyboard hidden, tapi keyboard tetap ter-mount', () => {
    const { container } = stage({ showKeyboard: false });
    const key = container.querySelector('[data-key]');
    expect(key).not.toBeNull();
    expect(key!.closest('[hidden]')).not.toBeNull();
  });

  it('kontrol negatif: default tampil', () => {
    const { container } = stage();
    expect(container.querySelector('[data-key]')!.closest('[hidden]')).toBeNull();
  });
});
