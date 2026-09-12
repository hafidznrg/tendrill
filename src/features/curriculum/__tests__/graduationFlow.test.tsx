import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import LessonPage from '@/pages/LessonPage';
import { STORAGE_KEYS, _resetForTests, read } from '@/lib/storage';

/**
 * Tes kelulusan kursus di layar (dok. 04 §4a, ADR-030).
 *
 * Kenapa ini tidak cukup diuji di `grading.test.ts`: fungsi pure di sana
 * membuktikan pembagiannya benar **kalau** halaman mengirim penanda yang benar.
 * Yang belum dibuktikan adalah bahwa penanda itu selamat melewati
 * `resolveDrills` → state → `gradeAttempt`, dan bahwa putusannya benar-benar
 * dirender serta ditulis ke `meta.graduatedAt`.
 *
 * Sama seperti `learnFlow.test.tsx`, `useCharMetrics` di-mock karena jsdom tidak
 * pernah mengukur lebar apa pun.
 */
vi.mock('@/features/typing/hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, ready: true }),
}));

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function currentTarget(): string {
  return document.querySelector('.ta-text')?.textContent ?? '';
}

async function renderLesson(lessonId: string): Promise<void> {
  render(
    <MemoryRouter initialEntries={[`/learn/${lessonId}`]}>
      <Routes>
        <Route path="/learn/:lessonId" element={<LessonPage />} />
        <Route path="/learn" element={<p>daftar kurikulum</p>} />
      </Routes>
    </MemoryRouter>,
  );
  for (let i = 0; i < 30; i++) {
    if (currentTarget().length > 0) break;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Kerjakan seluruh drill dengan benar sampai layar hasil muncul. */
async function playPerfectly(maxDrills = 12): Promise<void> {
  for (let i = 0; i < maxDrills; i++) {
    const target = currentTarget();
    expect(target.length).toBeGreaterThan(0);
    for (const char of target) press(char === '\n' ? ' ' : char);
    await act(async () => {
      await Promise.resolve();
    });
    if (screen.queryByRole('heading', { level: 2 })) return;
  }
  throw new Error('layar hasil tidak pernah muncul');
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

describe('u6-review — dua putusan di satu layar (ADR-030)', () => {
  it('lulus keduanya: panel kelulusan tampil dan graduatedAt tercatat', async () => {
    expect(read(STORAGE_KEYS.meta).graduatedAt).toBeUndefined();

    await renderLesson('u6-review');
    await playPerfectly();

    // Putusan lesson — ini yang membuka lesson berikutnya.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Lulus');

    // Putusan kursus — terpisah, dan menyebut ambangnya sendiri.
    const panel = screen.getByRole('heading', { level: 3 });
    expect(panel.textContent).toContain('40 WPM');
    expect(panel.textContent).toContain('95%');
    expect(document.querySelector('.rs-grad-body')?.textContent).toMatch(/^Lulus —/);

    expect(typeof read(STORAGE_KEYS.meta).graduatedAt).toBe('number');
  });

  /**
   * Pembanding "terbaik sebelumnya" tidak boleh muncul di lesson yang dinilai
   * dua kali (ADR-030). Angka di layar hanya bagian angka/simbol, sedangkan
   * riwayat menyimpan gabungan seluruh drill — panahnya akan membandingkan dua
   * hal yang tidak sebanding, dan bisa menunjuk ke bawah saat pengguna membaik.
   */
  it('u6-review tidak menampilkan pembanding percobaan sebelumnya', async () => {
    const { unmount } = render(<div />);
    unmount();

    // Percobaan pertama: menaruh catatan di riwayat.
    await renderLesson('u6-review');
    await playPerfectly();
    cleanup();

    // Percobaan kedua: riwayatnya sudah ada, jadi panah pembanding SEHARUSNYA
    // muncul kalau tidak sengaja disembunyikan.
    await renderLesson('u6-review');
    await playPerfectly();

    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy(); // memang u6-review
    expect(document.querySelectorAll('.rs-delta')).toHaveLength(0);
  });

  it('lesson biasa tidak pernah menampilkan panel kelulusan', async () => {
    await renderLesson('u1-l1');
    await playPerfectly();

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Lulus');
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
    expect(read(STORAGE_KEYS.meta).graduatedAt).toBeUndefined();
  });
});
