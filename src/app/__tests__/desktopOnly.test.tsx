import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../router';

/** jsdom tidak punya matchMedia; tiap test memasang jawabannya sendiri. */
function viewport(narrow: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: narrow && !query.includes('prefers-color-scheme'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('penolakan mobile (dok. 02 §8)', () => {
  for (const path of ['/learn/u1-l1', '/placement', '/practice', '/practice/adaptive']) {
    it(`${path} menolak viewport sempit`, async () => {
      viewport(true);
      renderAt(path);
      expect(
        await screen.findByRole('heading', { name: 'Latihan 10 jari butuh keyboard fisik.' }),
      ).toBeInTheDocument();
    });
  }

  it('kontrol negatif: viewport lebar tetap membuka sesi', async () => {
    viewport(false);
    renderAt('/practice');
    expect(
      await screen.findByRole('heading', { name: 'Latihan bebas' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Latihan 10 jari butuh keyboard fisik.')).toBeNull();
  });

  it('/stats tetap bisa dibaca di mobile', async () => {
    viewport(true);
    renderAt('/stats');
    expect(
      await screen.findByRole('heading', { name: 'Statistik' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
