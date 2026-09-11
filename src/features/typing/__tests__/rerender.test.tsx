import { describe, expect, it } from 'vitest';
import { Profiler, useState, type ProfilerOnRenderCallback } from 'react';
import { act, render } from '@testing-library/react';
import { TypingArea } from '../components/TypingArea.tsx';
import { useTypingSession } from '../hooks/useTypingSession.ts';
import { VirtualKeyboard } from '@/features/keyboard';

/**
 * Gerbang "nol re-render React per keystroke" (dok. 08 Fase 1 DoD, ADR-021).
 *
 * Dulu item ini dibaca dengan mata di React Profiler DevTools. `<Profiler>`
 * adalah API paket `react`, bukan fitur ekstensi — jadi ia jalan di Vitest dan
 * ikut `npm run verify`, artinya dijaga tiap commit, bukan sekali seumur proyek.
 *
 * Yang diuji adalah **kasus terburuk dok. 09 §5**: layar sesi DENGAN virtual
 * keyboard menyala. Itu kombinasi yang di Fase 1 belum bisa diuji karena
 * keyboardnya belum ada.
 *
 * Kalau test ini merah, tersangka pertamanya selalu sama: ada `useState` yang
 * baru masuk ke jalur keystroke. Jalur itu hanya boleh menulis `className` pada
 * 1–2 span, menggeser `transform` caret, dan memanggil pelukis keyboard.
 */

const TARGET = 'ff jj ff jj';

function Harness({ onRender }: { onRender: ProfilerOnRenderCallback }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const session = useTypingSession({
    target: TARGET,
    cols: 40,
    charWidth: 10,
    lineHeight: 20,
  });
  return (
    <Profiler id="sesi" onRender={onRender}>
      <TypingArea
        session={session}
        charWidth={10}
        lineHeight={20}
        onMeasureEl={(node) => setEl(node)}
        key={el ? 'ready' : 'init'}
      />
      <VirtualKeyboard onReady={session.registerNextKeyPainter} />
    </Profiler>
  );
}

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('nol re-render per keystroke (dok. 09 §5, ADR-021)', () => {
  it('mengetik seluruh drill tidak memicu satu commit pun', () => {
    const commits: { phase: string; duration: number }[] = [];
    const onRender: ProfilerOnRenderCallback = (_id, phase, duration) => {
      commits.push({ phase, duration });
    };

    render(<Harness onRender={onRender} />);

    // Render awal + pemasangan span/keyboard memang memakai React. Yang dijaga
    // adalah apa yang terjadi SESUDAHNYA.
    commits.length = 0;

    for (const char of TARGET) press(char === ' ' ? ' ' : char);

    // Tepat DUA commit untuk 11 keystroke, dan keduanya transisi STRUKTURAL
    // yang memang diizinkan ber-setState (dok. 03 §6): idle → running pada
    // keystroke pertama, running → finished pada yang terakhir. Angkanya
    // dikunci tepat, bukan "≤", supaya commit ketiga yang menyelinap masuk
    // langsung membuat test ini merah.
    expect(commits).toHaveLength(2);
    expect(commits.every((c) => c.phase === 'update')).toBe(true);
  });

  it('keystroke di tengah sesi benar-benar nol commit', () => {
    const commits: string[] = [];
    render(
      <Harness
        onRender={(_id, phase) => {
          commits.push(phase);
        }}
      />,
    );

    // Keystroke pertama memulai sesi (idle → running): satu transisi status.
    press('f');
    commits.length = 0;

    // Sisa drill, berhenti sebelum karakter terakhir supaya transisi selesai
    // tidak ikut terhitung.
    const middle = TARGET.slice(1, -1);
    for (const char of middle) press(char);

    expect(commits).toEqual([]);
  });

  it('backspace juga tidak merender ulang', () => {
    const commits: string[] = [];
    render(
      <Harness
        onRender={(_id, phase) => {
          commits.push(phase);
        }}
      />,
    );

    press('f');
    press('f');
    commits.length = 0;

    press('Backspace');
    press('f');

    expect(commits).toEqual([]);
  });
});
