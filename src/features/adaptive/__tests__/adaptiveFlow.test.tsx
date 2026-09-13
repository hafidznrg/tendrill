import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AdaptivePage from '@/pages/AdaptivePage';
import HomePage from '@/pages/HomePage';
import { STORAGE_KEYS, _resetForTests, flushPendingWrites, read, write } from '@/lib/storage';
import {
  defaultKeystats,
  defaultSessions,
  type KeyStat,
  type SessionRecord,
} from '@/lib/storage/schema.ts';
// Lihat `practiceFlow.test.tsx`: impor statis di test supaya `import()` halaman
// selesai di microtask. Kode produksi tetap dinamis (dijaga `npm run chunkgraph`).
import '@/data/wordlists/en';

/**
 * `/practice/adaptive` dan kartu dashboard dari ujung ke ujung (dok. 08 Fase 7).
 * Butir "tidak crash saat statistik sedikit" diperiksa di layar, bukan hanya di
 * fungsi pure: halaman yang menerima `ready: false` masih bisa salah merender.
 */
vi.mock('@/features/typing/hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, width: 520, ready: true }),
}));

function session(i: number): SessionRecord {
  return {
    id: `s${i}`,
    at: Date.now() - i * 3600_000,
    source: 'lesson',
    durationMs: 30000,
    netWpm: 30,
    grossWpm: 32,
    accuracy: 95,
    consistency: 0.8,
    totalKeystrokes: 150,
    correctKeystrokes: 142,
  };
}

function seed(sessions: number, keys: Record<string, KeyStat>): void {
  write(STORAGE_KEYS.sessions, {
    ...defaultSessions(),
    items: Array.from({ length: sessions }, (_, i) => session(i)),
  });
  write(STORAGE_KEYS.keystats, { ...defaultKeystats(), keys });
}

function weakKeys(): Record<string, KeyStat> {
  const keys: Record<string, KeyStat> = {};
  for (const c of 'abcdefghijklmnopqrstuvwxyz') {
    keys[c] = { attempts: 200, errors: 2, totalMs: 200 * 180, slowCount: 0 };
  }
  keys['r'] = { attempts: 200, errors: 40, totalMs: 200 * 180, slowCount: 0 };
  keys['p'] = { attempts: 100, errors: 0, totalMs: 100 * 340, slowCount: 0 };
  return keys;
}

function renderAt(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('statistik masih sedikit', () => {
  it('pengguna baru: halaman menjelaskan kenapa, tanpa tombol mulai dan tanpa NaN', () => {
    renderAt(<AdaptivePage />);
    expect(screen.getByText(/setidaknya 5 sesi/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mulai drill/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('cukup sesi tapi tombol < 10 kemunculan: alasan kedua', () => {
    seed(8, { a: { attempts: 9, errors: 9, totalMs: 9000, slowCount: 0 } });
    renderAt(<AdaptivePage />);
    expect(screen.getByText(/Belum ada tombol yang menonjol/)).toBeTruthy();
  });

  it('dashboard tidak menampilkan kartu kelemahan sebelum datanya cukup', () => {
    seed(2, weakKeys());
    renderAt(<HomePage />);
    expect(screen.queryByRole('link', { name: /Latih kelemahanmu/ })).toBeNull();
  });
});

describe('alur latihan adaptif', () => {
  it('dashboard menunjuk tombol terlemah dan tautan ke drill', () => {
    seed(8, weakKeys());
    renderAt(<HomePage />);
    const link = screen.getByRole('link', { name: /Latih kelemahanmu/ });
    expect(link.getAttribute('href')).toBe('/practice/adaptive');
    expect(screen.getByText(/20% salah/)).toBeTruthy();
    expect(screen.getByText(/lambat · 340 ms/)).toBeTruthy();
  });

  it('drill diketik sampai habis tersimpan sebagai practice/adaptive', async () => {
    seed(8, weakKeys());
    renderAt(<AdaptivePage />);
    act(() => {
      screen.getByRole('button', { name: /Mulai drill/ }).click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    const target = document.querySelector('.ta-text')?.textContent ?? '';
    expect(target.length).toBeGreaterThan(100);
    expect(target).toMatch(/^[a-z ]+$/);

    for (const char of target) {
      press(char);
      act(() => {
        vi.advanceTimersByTime(120);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    flushPendingWrites();

    const items = read(STORAGE_KEYS.sessions).items;
    const last = items[items.length - 1]!;
    expect(items).toHaveLength(9);
    expect(last).toMatchObject({ source: 'practice', mode: 'adaptive' });
    expect(read(STORAGE_KEYS.progress).lessons).toEqual({});
  });
});
