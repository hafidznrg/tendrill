import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { TypingArea } from '../components/TypingArea.tsx';
import { useTypingSession } from '../hooks/useTypingSession.ts';
import { VirtualKeyboard } from '@/features/keyboard';

/**
 * Dua perbaikan jalur input yang dikerjakan sekali jalan (ADR-043):
 *
 * 1. **Backspace disorot** selama karakter tepat sebelum kursor salah — uji pemula
 *    menemukan mereka berhenti dan melihat keyboard untuk mencarinya.
 * 2. **Spasi sebelum keystroke pertama tidak menggulung halaman.**
 *
 * Keduanya diuji dengan kontrol negatif: mode strict tidak pernah menyorot
 * Backspace, dan sesi yang sudah selesai tidak lagi merampas spasi.
 */

function Harness({ target, strict = false }: { target: string; strict?: boolean }) {
  const session = useTypingSession({ target, cols: 40, charWidth: 10, lineHeight: 20, strict });
  return (
    <>
      <TypingArea session={session} charWidth={10} onMeasureEl={() => {}} />
      <VirtualKeyboard onReady={session.registerNextKeyPainter} />
    </>
  );
}

/** Mengembalikan true kalau `preventDefault` dipanggil. */
function press(key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    document.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

function setup(target: string, strict = false) {
  const { container } = render(<Harness target={target} strict={strict} />);
  const backspace = container.querySelector<HTMLElement>('[data-key="Backspace"]')!;
  const next = () =>
    [...container.querySelectorAll<HTMLElement>('.vk-next')].map((el) => el.dataset['key']);
  return { backspace, next, fixLit: () => backspace.classList.contains('vk-fix') };
}

describe('sorotan Backspace (ADR-043)', () => {
  it('non-strict: menyala sesudah salah, padam sesudah Backspace', () => {
    const { fixLit, next } = setup('fj fj');
    expect(fixLit()).toBe(false);

    press('k'); // salah di indeks 0, kursor maju
    expect(fixLit()).toBe(true);
    // Tombol berikutnya tetap disorot — non-strict tidak memaksa koreksi.
    expect(next()).toEqual(['j']);

    press('Backspace');
    expect(fixLit()).toBe(false);
    expect(next()).toEqual(['f']);
  });

  it('non-strict: padam begitu karakter sebelum kursor benar lagi', () => {
    const { fixLit } = setup('fj fj');
    press('k');
    press('j');
    expect(fixLit()).toBe(false);
  });

  it('beberapa salah berturut-turut: tetap menyala sampai semuanya dihapus', () => {
    const { fixLit } = setup('fj fj');
    press('k');
    press('k');
    press('Backspace');
    expect(fixLit()).toBe(true);
    press('Backspace');
    expect(fixLit()).toBe(false);
  });

  // Kontrol negatif: di strict jalur koreksinya adalah tombol yang benar.
  it('strict: tidak pernah menyala', () => {
    const { fixLit, next } = setup('fj fj', true);
    press('k');
    expect(fixLit()).toBe(false);
    expect(next()).toEqual(['f']);
  });

  it('kelas ditulis hanya saat keadaannya berganti, bukan per keystroke', () => {
    const { backspace } = setup('fjfjfjfj');
    let writes = 0;
    const observer = new MutationObserver((records) => (writes += records.length));
    observer.observe(backspace, { attributes: true, attributeFilter: ['class'] });

    press('k'); // nyala
    for (const char of 'jfjfjf') press(char); // padam di keystroke pertama, lalu diam
    observer.takeRecords().forEach(() => writes++);
    observer.disconnect();
    expect(writes).toBe(2);
  });
});

describe('spasi tidak menggulung halaman (ADR-043)', () => {
  it('sebelum keystroke pertama: diblokir dan tetap diteruskan sebagai ketikan', () => {
    const { fixLit } = setup('f j');
    expect(press(' ')).toBe(true);
    // Spasi di posisi 'f' salah — bukti ia sampai ke engine, bukan ditelan.
    expect(fixLit()).toBe(true);
  });

  it('selama sesi berjalan: tetap diblokir', () => {
    setup('f j');
    press('f');
    expect(press(' ')).toBe(true);
  });

  // Kontrol negatif: sesudah sesi selesai, halaman boleh menggulung lagi.
  it('sesudah sesi selesai: tidak dirampas', () => {
    setup('fj');
    press('f');
    press('j');
    expect(press(' ')).toBe(false);
  });
});

describe('sorotan Backspace di akhir drill (ADR-043)', () => {
  it('karakter terakhir salah (non-strict): tidak menyala di belakang layar hasil', () => {
    const { fixLit } = setup('fj');
    press('f');
    press('k'); // salah, dan sesi selesai
    expect(fixLit()).toBe(false);
  });
});
