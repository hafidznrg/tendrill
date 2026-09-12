import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../router';

const CASES: Array<[string, string]> = [
  ['/', 'tendrill'],
  ['/learn', 'Kurikulum'],
  // Judul lesson datang dari kurikulum, bukan dari nomor urut — "Lesson 1"
  // hanya benar selama halaman ini masih hardcode (Fase 2). Sejak Fase 3 ia
  // memuat lesson sungguhan lewat :lessonId.
  ['/learn/u1-l1', 'Unit 1 · Keys F and J'],
  ['/placement', 'Placement test'],
  ['/posture', 'Sebelum ketukan pertama'],
  ['/practice', 'Latihan bebas'],
  ['/stats', 'Statistik'],
  ['/settings', 'Pengaturan'],
  ['/rute-yang-tidak-ada', 'tendrill'],
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
