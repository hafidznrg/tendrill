import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import type { SessionResult } from '@/lib/engine';
import { ResultScreen } from '../components/ResultScreen.tsx';

function makeResult(over: Partial<SessionResult> = {}): SessionResult {
  return {
    target: 'test',
    durationMs: 10_000,
    grossWPM: 40,
    netWPM: 38,
    accuracy: 95,
    totalKeystrokes: 100,
    correctKeystrokes: 95,
    consistency: 0.8,
    errorsByKey: {},
    latencyByKey: {},
    confusions: [],
    logOverflowed: false,
    completedAt: Date.now(),
    ...over,
  };
}

function press(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('ResultScreen (dok. 09 §6)', () => {
  it('menampilkan lulus/gagal sesuai kriteria', () => {
    const { rerender } = render(
      <ResultScreen
        result={makeResult({ netWPM: 27, accuracy: 92 })}
        voided={false}
        criteria={{ minWpm: 25, minAccuracy: 95 }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Belum lulus');
    // Selisihnya disebut konkret, bukan "coba lagi ya".
    expect(screen.getByText(/Butuh 25 WPM & 95%/)).toBeInTheDocument();

    rerender(
      <ResultScreen
        result={makeResult({ netWPM: 30, accuracy: 97 })}
        voided={false}
        criteria={{ minWpm: 25, minAccuracy: 95 }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Lulus');
  });

  it('tanpa kriteria (latihan bebas) hanya menampilkan skor', () => {
    render(<ResultScreen result={makeResult()} voided={false} onRetry={() => {}} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Selesai');
    expect(screen.queryByText(/Butuh/)).not.toBeInTheDocument();
  });

  it('sesi void TIDAK menampilkan angka apa pun (dok. 02 §5)', () => {
    render(<ResultScreen result={null} voided onRetry={() => {}} />);

    expect(screen.getByRole('heading')).toHaveTextContent('Sesi tidak dihitung');
    expect(screen.queryByText(/wpm/i)).not.toBeInTheDocument();
    expect(screen.getByText(/jeda lebih dari 30 detik/)).toBeInTheDocument();
  });

  it('menampilkan kalimat diagnosis', () => {
    render(
      <ResultScreen
        result={makeResult({ confusions: [{ expected: 'e', actual: 'r', count: 4 }] })}
        voided={false}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/diketik sebagai/)).toBeInTheDocument();
  });

  it('membandingkan dengan percobaan terbaik, tapi hanya kalau selisihnya bermakna', () => {
    const { rerender } = render(
      <ResultScreen
        result={makeResult({ netWPM: 38 })}
        voided={false}
        previousBest={{ netWpm: 30, accuracy: 95 }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText('+8.0')).toBeInTheDocument();

    // Selisih 0,2 WPM adalah derau — jangan ditampilkan.
    rerender(
      <ResultScreen
        result={makeResult({ netWPM: 38 })}
        voided={false}
        previousBest={{ netWpm: 37.9, accuracy: 95 }}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByText(/^\+0\.1$/)).not.toBeInTheDocument();
  });

  it('Enter mengulangi, N lanjut, Esc keluar (dok. 07 §7)', () => {
    const onRetry = vi.fn();
    const onNext = vi.fn();
    const onExit = vi.fn();
    render(
      <ResultScreen
        result={makeResult()}
        voided={false}
        onRetry={onRetry}
        onNext={onNext}
        onExit={onExit}
      />,
    );

    press('Enter');
    press('n');
    press('Escape');

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('tombol Lanjut tidak muncul kalau tidak ada lesson berikutnya', () => {
    render(<ResultScreen result={makeResult()} voided={false} onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: /Lanjut/ })).not.toBeInTheDocument();
  });

  it('diumumkan ke screen reader (dok. 07 §8)', () => {
    const { container } = render(
      <ResultScreen result={makeResult()} voided={false} onRetry={() => {}} />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });
});
