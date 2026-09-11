import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { TypingArea } from '../components/TypingArea.tsx';
import { useTypingSession } from '../hooks/useTypingSession.ts';

/**
 * Uji komponen terbatas (dok. 09 §6) — hanya yang punya logika.
 *
 * Yang diuji di sini adalah kontrak yang mudah rusak diam-diam saat refactor:
 * span dibangun sekali dan TIDAK dibuat ulang per keystroke, kelasnya berubah
 * sesuai status karakter, dan paste benar-benar terblokir.
 */

const TARGET = 'ff jj';

function Harness() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const session = useTypingSession({
    target: TARGET,
    cols: 40,
    charWidth: 10,
    lineHeight: 20,
  });
  return (
    <TypingArea
      session={session}
      charWidth={10}
      lineHeight={20}
      onMeasureEl={(node) => setEl(node)}
      key={el ? 'ready' : 'init'}
    />
  );
}

function press(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
}

function spans(container: HTMLElement): HTMLSpanElement[] {
  return [...container.querySelectorAll('.ta-text span')] as HTMLSpanElement[];
}

describe('TypingArea (dok. 09 §6)', () => {
  it('membangun satu span per karakter target', () => {
    const { container } = render(<Harness />);
    const list = spans(container);
    expect(list).toHaveLength(TARGET.length);
    expect(list.map((s) => s.textContent).join('')).toBe(TARGET);
    expect(list.every((s) => s.className === 'ta-pending')).toBe(true);
  });

  it('menampilkan status karakter yang benar, dan span-nya tidak pernah dibuat ulang', () => {
    const { container } = render(<Harness />);
    const before = spans(container);

    press('f');
    press('x'); // salah: seharusnya 'f'

    const after = spans(container);
    // Identitas elemen sama → React tidak membangun ulang lapisan teks (R-08).
    expect(after.every((s, i) => s === before[i])).toBe(true);
    expect(after[0]!.className).toBe('ta-correct');
    expect(after[1]!.className).toBe('ta-incorrect');
    expect(after[2]!.className).toBe('ta-pending');
  });

  it('backspace lalu ketik ulang menandai karakter sebagai corrected', () => {
    const { container } = render(<Harness />);
    press('f');
    press('x');
    press('Backspace');
    press('f');

    expect(spans(container)[1]!.className).toBe('ta-corrected');
  });

  it('caret bergeser secara aritmetika, bukan lewat pengukuran DOM', () => {
    const { container } = render(<Harness />);
    const caret = container.querySelector('.ta-caret') as HTMLElement;

    press('f');
    press('f');
    // 2 karakter × charWidth 10 px, masih di baris 0.
    expect(caret.style.transform).toBe('translate(20px, 0px)');
  });
});

describe('penangkapan input (dok. 03 §2)', () => {
  it('memblokir paste, drop, dan Shift+Insert', () => {
    render(<Harness />);

    const paste = new Event('paste', { bubbles: true, cancelable: true });
    document.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);

    const drop = new Event('drop', { bubbles: true, cancelable: true });
    document.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);

    const shiftInsert = new KeyboardEvent('keydown', {
      key: 'Insert',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.dispatchEvent(shiftInsert);
    });
    expect(shiftInsert.defaultPrevented).toBe(true);
  });

  it('Tab dicegah default-nya dan me-restart sesi', () => {
    const { container } = render(<Harness />);
    press('f');
    expect(spans(container)[0]!.className).toBe('ta-correct');

    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => {
      document.dispatchEvent(tab);
    });

    expect(tab.defaultPrevented).toBe(true);
    expect(spans(container).every((s) => s.className === 'ta-pending')).toBe(true);
  });

  it('modifier dan pintasan browser tidak tercatat sebagai keystroke', () => {
    const { container } = render(<Harness />);

    press('Shift');
    press('Control');
    press('ArrowRight');
    press('t', { ctrlKey: true }); // Ctrl+T milik browser
    press('l', { metaKey: true });

    expect(spans(container).every((s) => s.className === 'ta-pending')).toBe(true);
  });
});
