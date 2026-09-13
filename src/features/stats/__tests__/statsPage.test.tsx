import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StatsPage from '@/pages/StatsPage';
import { STORAGE_KEYS, _resetForTests, write } from '@/lib/storage';
import { defaultKeystats, defaultSessions, type SessionRecord } from '@/lib/storage/schema.ts';

/**
 * `/stats` dirender dengan 0, 1, dan 200 sesi (dok. 08 Fase 6 DoD). Yang
 * diperiksa bukan piksel, melainkan hal yang pasti salah kalau terjadi: teks
 * `NaN`/`Infinity` di mana pun, atribut SVG yang tidak finite, dan grafik yang
 * diam-diam tidak menggambar apa pun padahal datanya ada.
 */

function session(i: number, netWpm = 30 + (i % 20), accuracy = 90 + (i % 10)): SessionRecord {
  return {
    id: `s${i}`,
    at: new Date(2026, 8, 13).getTime() - (200 - i) * 3600_000,
    source: i % 2 ? 'practice' : 'lesson',
    durationMs: 30000,
    netWpm,
    grossWpm: netWpm + 2,
    accuracy,
    consistency: 0.8,
    totalKeystrokes: 150,
    correctKeystrokes: 140,
  };
}

function seed(count: number): void {
  write(STORAGE_KEYS.sessions, {
    ...defaultSessions(),
    items: Array.from({ length: count }, (_, i) => session(i)),
  });
  if (count > 0) {
    write(STORAGE_KEYS.keystats, {
      ...defaultKeystats(),
      keys: {
        f: { attempts: 120, errors: 20, totalMs: 24000, slowCount: 0 },
        a: { attempts: 5, errors: 0, totalMs: 1000, slowCount: 0 },
      },
      daily: {
        '2026-09-12': { sessions: count, ms: count * 30000, avgWpm: 35, avgAccuracy: 95 },
      },
    });
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StatsPage />
    </MemoryRouter>,
  );
}

function assertNoBrokenNumbers(container: HTMLElement): void {
  expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  for (const el of container.querySelectorAll('svg *')) {
    for (const attr of el.getAttributeNames()) {
      expect(el.getAttribute(attr), `${el.tagName}[${attr}]`).not.toMatch(/NaN|Infinity/);
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

describe('/stats untuk 0, 1, dan 200 sesi', () => {
  it('0 sesi: empty state yang menunjuk jalan, tanpa NaN', () => {
    const { container } = renderPage();
    expect(screen.getByText(/Belum ada sesi\./)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /belum ada data/ })).toHaveLength(2);
    expect(container.querySelectorAll('.st-line')).toHaveLength(0);
    expect(container.querySelectorAll('.st-day')).toHaveLength(30);
    assertNoBrokenNumbers(container);
  });

  it('1 sesi: satu titik per grafik, bukan garis', () => {
    seed(1);
    const { container } = renderPage();
    expect(screen.queryByText(/Belum ada sesi\./)).toBeNull();
    expect(container.querySelectorAll('.st-line')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
    assertNoBrokenNumbers(container);
  });

  it('200 sesi: dua garis 200 titik, tanpa lingkaran per titik', () => {
    seed(200);
    const { container } = renderPage();
    const lines = container.querySelectorAll('.st-line');
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line.getAttribute('d')!.match(/[ML]/g)).toHaveLength(200);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(screen.getByRole('img', { name: /WPM per sesi: 200 sesi/ })).toBeInTheDocument();
    assertNoBrokenNumbers(container);
  });

  it('heatmap: tombol berdata cukup diwarnai, tombol < 10 kemunculan netral', () => {
    seed(3);
    const { container } = renderPage();
    const errorMap = container.querySelector('.hm-error')!;
    expect(errorMap.querySelector('[data-key="f"]')!.getAttribute('data-level')).toBe('4');
    expect(errorMap.querySelector('[data-key="a"]')!.getAttribute('data-level')).toBe('few');
    expect(errorMap.querySelector('[data-key="Tab"]')!.getAttribute('data-level')).toBe('none');
  });
});
