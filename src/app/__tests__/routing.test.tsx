import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../router';

const CASES: Array<[string, string]> = [
  ['/', 'Beranda'],
  ['/learn', 'Kurikulum'],
  ['/learn/u1-l1', 'Unit 1 · Lesson 1'],
  ['/practice', 'Latihan bebas'],
  ['/stats', 'Statistik'],
  ['/settings', 'Pengaturan'],
  ['/rute-yang-tidak-ada', 'Beranda'],
];

describe('peta rute (dok. 02 §1)', () => {
  for (const [path, heading] of CASES) {
    it(`${path} merender halamannya`, async () => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>,
      );
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    });
  }
});
