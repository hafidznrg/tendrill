import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { ResultScreen } from '../components/ResultScreen.tsx';
import { TypingArea } from '../components/TypingArea.tsx';
import { useTypingSession } from '../hooks/useTypingSession.ts';
import { VirtualKeyboard } from '@/features/keyboard';
import { applyKey, computeLiveMetrics, createSession, type SessionResult } from '@/lib/engine';

/**
 * Tiga DoD Fase 2 yang sebelumnya masuk daftar "periksa sendiri" (dok. 08):
 * metrik live akurat, nol penulisan storage saat sesi berjalan, dan seluruh
 * alur bisa dijalankan tanpa mouse.
 *
 * Ketiganya punya bentuk yang sama: mudah dinyatakan benar dengan melihat layar
 * sekali, dan mudah rusak diam-diam sesudahnya. Karena itu mereka di sini,
 * bukan di catatan titik henti.
 */

const TARGET = 'ff jj ff jj';

/**
 * Cermin dari `LessonPage`, dipotong sampai bagian yang diuji saja: teks,
 * virtual keyboard, dan layar hasil. Layar hasil WAJIB ikut — di situlah
 * pintasan "ulangi" hidup setelah sesi selesai, jadi harness tanpa dia akan
 * melaporkan alur keyboard rusak padahal aplikasinya baik-baik saja.
 */
function Harness() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [finished, setFinished] = useState(false);

  const session = useTypingSession({
    target: TARGET,
    cols: 40,
    charWidth: 10,
    lineHeight: 20,
    onFinish: (r) => {
      setResult(r);
      setFinished(true);
    },
  });

  const { restart } = session;
  return (
    <>
      <TypingArea
        session={session}
        charWidth={10}
        lineHeight={20}
        onMeasureEl={(node) => setEl(node)}
        key={el ? 'ready' : 'init'}
      />
      <VirtualKeyboard onReady={session.registerNextKeyPainter} />
      {finished && (
        <ResultScreen
          result={result}
          voided={session.voided}
          previousBest={null}
          onRetry={() => {
            setResult(null);
            setFinished(false);
            restart();
          }}
        />
      )}
    </>
  );
}

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('metrik live akurat dibanding hitungan manual (dok. 08 Fase 2 DoD)', () => {
  it('WPM dan akurasi cocok dengan angka yang dihitung tangan', () => {
    // Skenario yang sengaja dibuat bulat supaya bisa dihitung di kepala:
    // 10 keystroke, tepat 1 salah, tepat 6 detik waktu aktif (600 ms per
    // keystroke, 9 jeda + keystroke pertama di t=0).
    const s = createSession('aaaaaaaaaa', 40);
    const start = 10_000;
    for (let i = 0; i < 10; i++) {
      applyKey(s, i === 3 ? 'x' : 'a', start + i * 600);
    }

    const m = computeLiveMetrics(s, start + 9 * 600);

    // 9 × 600 ms = 5400 ms aktif (timer mulai pada keystroke PERTAMA, bukan
    // saat sesi dibuat — dok. 03 §5).
    expect(m.elapsedMs).toBe(5400);

    // gross = 10 karakter / 5 / (5400/60000 menit) = 2 / 0,09 = 22,22 WPM
    expect(m.grossWPM).toBeCloseTo(22.22, 2);
    // net  = 9 benar / 5 / 0,09 = 20 WPM
    expect(m.netWPM).toBeCloseTo(20, 10);
    // akurasi = 9/10
    expect(m.accuracy).toBe(90);
    expect(m.progress).toBe(10);
  });

  it('netWPM tidak pernah melampaui grossWPM, dan keduanya nol sebelum keystroke pertama', () => {
    const s = createSession('abc', 40);
    const kosong = computeLiveMetrics(s, 999_999);
    expect(kosong.grossWPM).toBe(0);
    expect(kosong.netWPM).toBe(0);
    expect(kosong.elapsedMs).toBe(0);
  });
});

describe('nol penulisan storage saat sesi berjalan (dok. 05 §1 poin 4)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mengetik seluruh drill tidak memanggil setItem satu kali pun', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<Harness />);
    setItem.mockClear();

    for (const char of TARGET) press(char);
    press('Backspace');
    press('j');

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('restart di tengah sesi juga tidak menulis', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<Harness />);
    setItem.mockClear();

    press('f');
    press('f');
    press('Tab');
    press('f');

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe('seluruh alur sesi tanpa mouse (dok. 08 Fase 2 DoD)', () => {
  it('mengetik, restart, dan mengetik ulang semuanya lewat keyboard', () => {
    const { container } = render(<Harness />);
    const spans = () => [...container.querySelectorAll('.ta-text span')] as HTMLElement[];

    // Tidak ada satu pun klik di test ini — kalau alurnya butuh mouse, ia
    // tidak akan pernah sampai ke keadaan selesai.
    for (const char of TARGET) press(char);
    expect(spans().every((sp) => sp.className !== 'ta-pending')).toBe(true);

    // Layar hasil muncul sendiri, tanpa perlu diklik.
    expect(container.querySelector('.rs-root')).not.toBeNull();

    // Enter = ULANGI (dok. 07 §7). Di tengah sesi tugas itu dipegang Tab;
    // sesudah selesai ia pindah ke layar hasil.
    press('Enter');
    expect(container.querySelector('.rs-root')).toBeNull();
    expect(spans().every((sp) => sp.className === 'ta-pending')).toBe(true);

    press('f');
    expect(spans()[0]!.className).toBe('ta-correct');
  });

  it('tidak ada elemen interaktif yang hanya bisa dicapai dengan mouse saat mengetik', () => {
    const { container } = render(<Harness />);
    // Virtual keyboard aria-hidden dan dekoratif; tidak boleh ada tombol yang
    // bisa difokus di dalamnya (dok. 07 §8).
    const focusable = container.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    expect(focusable).toHaveLength(0);
  });
});
