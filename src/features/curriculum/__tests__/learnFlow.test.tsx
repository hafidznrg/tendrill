import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import LessonPage from '@/pages/LessonPage';
import { STORAGE_KEYS, _resetForTests, read, write } from '@/lib/storage';
import { defaultProgress } from '@/lib/storage/schema.ts';
import type { LessonStatus } from '@/lib/storage/schema.ts';

/**
 * Alur `/learn/:lessonId` dari ujung ke ujung (dok. 09 §4).
 *
 * Berjalan di **mode strict**, karena itulah default `/learn` sejak ADR-029.
 *
 * Tiga hal yang hanya bisa diuji di sini, bukan di fungsi pure:
 * 1. **Drill dikerjakan berurutan dalam satu sesi** (dok. 04 §2) dan kelulusan
 *    dinilai terhadap gabungannya.
 * 2. **Assist ladder benar-benar muncul** di layar hasil pada percobaan 3, 4,
 *    dan 6 — DoD Fase 3 menyebut "aktif", dan fungsi yang mengembalikan flag
 *    tidak membuktikan flag itu dirender.
 * 3. Kelulusan tersimpan sehingga lesson berikutnya terbuka.
 *
 * `useCharMetrics` di-mock karena jsdom tidak pernah mengukur lebar apa pun
 * (`getBoundingClientRect()` selalu 0), dan tanpa metrik siap input memang
 * sengaja dimatikan. Yang di-mock hanya angkanya — seluruh jalur input, engine,
 * dan penyimpanan tetap yang asli.
 */
vi.mock('@/features/typing/hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, ready: true }),
}));

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

/** Teks drill yang sedang tampil, dibaca dari span yang dipasang TypingArea. */
function currentTarget(): string {
  const el = document.querySelector('.ta-text');
  return el?.textContent ?? '';
}

function typeCurrentDrill(correct: boolean): void {
  const target = currentTarget();
  expect(target.length).toBeGreaterThan(0);
  for (const char of target) {
    if (correct) {
      press(char);
      continue;
    }
    // Sejak ADR-029, `/learn` default **strict**: tombol salah menahan kursor,
    // jadi mengetik salah saja tidak akan pernah menyelesaikan drill — dan
    // itulah yang dilakukan pengguna sungguhan yang kesulitan: salah dulu, lalu
    // menemukan tombol yang benar. Percobaan pertama yang salah tetap tercatat
    // (ADR-003), jadi akurasinya jatuh dan lesson memang tidak lulus.
    press(char === 'f' ? 'j' : 'f');
    press(char);
  }
}

/** Kerjakan seluruh drill satu lesson sampai layar hasil muncul. */
async function playLesson(correct: boolean, maxDrills = 12): Promise<void> {
  for (let i = 0; i < maxDrills; i++) {
    typeCurrentDrill(correct);
    await act(async () => {
      await Promise.resolve();
    });
    if (screen.queryByRole('heading', { level: 2 })) return;
  }
  throw new Error('layar hasil tidak pernah muncul');
}

async function renderLesson(lessonId = 'u1-l1'): Promise<void> {
  render(
    <MemoryRouter initialEntries={[`/learn/${lessonId}`]}>
      <Routes>
        <Route path="/learn/:lessonId" element={<LessonPage />} />
        <Route path="/learn" element={<p>daftar kurikulum</p>} />
      </Routes>
    </MemoryRouter>,
  );
  // Lesson dimuat lewat rantai dynamic import (unit ini, unit berikutnya, lalu
  // pool wordlist), jadi satu macrotask tidak cukup. Ditunggu sampai drill
  // pertama benar-benar terpasang, atau sampai halaman menyatakan gagal.
  for (let i = 0; i < 20; i++) {
    if (currentTarget().length > 0 || screen.queryByText('Lesson tidak ditemukan')) break;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function seedAttempts(lessonId: string, attempts: number, status: LessonStatus): void {
  const progress = defaultProgress();
  progress.lessons[lessonId] = {
    status,
    attempts,
    bestWpm: 8,
    bestAccuracy: 70,
    firstPassedAt: null,
    lastAttemptAt: 1,
  };
  write(STORAGE_KEYS.progress, progress);
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

describe('satu lesson = beberapa drill berurutan (dok. 04 §2)', () => {
  it('maju dari drill ke drill, lalu menilai gabungannya', async () => {
    await renderLesson();

    expect(screen.getByText(/drill 1\/\d/)).toBeTruthy();
    const firstDrill = currentTarget();

    typeCurrentDrill(true);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/drill 2\/\d/)).toBeTruthy();
    expect(currentTarget()).not.toBe(firstDrill);
    // Belum ada layar hasil di tengah lesson — kelulusan dinilai sekali, di akhir.
    expect(screen.queryByText(/Lulus|Belum lulus/)).toBeNull();

    await playLesson(true);
    expect(screen.getByText('Lulus')).toBeTruthy();
  });

  it('kelulusan tersimpan, dan lesson berikutnya jadi terbuka', async () => {
    await renderLesson();
    await playLesson(true);

    const saved = read(STORAGE_KEYS.progress);
    expect(saved.lessons['u1-l1']).toMatchObject({ status: 'passed', attempts: 1 });
    // Hasil sesi ikut tersimpan sebagai riwayat (dok. 05 §3).
    expect(read(STORAGE_KEYS.sessions).items.at(-1)?.lessonId).toBe('u1-l1');
  });

  it('akurasi buruk → belum lulus, dan progres mencatatnya sebagai percobaan', async () => {
    await renderLesson();
    await playLesson(false);

    expect(screen.getByText('Belum lulus')).toBeTruthy();
    expect(read(STORAGE_KEYS.progress).lessons['u1-l1']).toMatchObject({
      status: 'attempted',
      attempts: 1,
    });
  });
});

describe('assist ladder aktif di layar hasil (dok. 04 §9)', () => {
  it('percobaan 1–2: tanpa tawaran bantuan apa pun', async () => {
    seedAttempts('u1-l1', 1, 'attempted');
    await renderLesson();
    await playLesson(false);

    expect(screen.queryByText(/Drill 30 detik/)).toBeNull();
    expect(screen.queryByText('Lanjut saja')).toBeNull();
    expect(screen.queryByText(/Target kecepatan diturunkan/)).toBeNull();
  });

  it('percobaan 3: menawarkan drill mikro yang MENYEBUT tombolnya', async () => {
    seedAttempts('u1-l1', 2, 'attempted');
    await renderLesson();
    await playLesson(false);

    const micro = screen.getByText(/Drill 30 detik untuk/);
    expect(micro).toBeTruthy();
    expect(screen.queryByText(/Target kecepatan diturunkan/)).toBeNull();
    expect(screen.queryByText('Lanjut saja')).toBeNull();
  });

  it('percobaan 4: target WPM diturunkan, dan dikatakan — akurasi tidak', async () => {
    seedAttempts('u1-l1', 3, 'attempted');
    await renderLesson();

    // Target yang ditampilkan sebelum mengetik sudah memakai angka yang turun:
    // 18 WPM → 14 (u1-l1 = 18/95, ×0,8 dibulatkan).
    expect(screen.getByText(/target 14 wpm · 95%/)).toBeTruthy();

    await playLesson(false);
    const note = screen.getByText(/Target kecepatan diturunkan/);
    expect(note.textContent).toContain('14 WPM');
    expect(note.textContent).toContain('95%');
  });

  it('percobaan 6: menawarkan "lanjut saja" → passed-with-assist', async () => {
    seedAttempts('u1-l1', 5, 'attempted');
    await renderLesson();
    await playLesson(false);

    const skip = screen.getByText('Lanjut saja');
    act(() => skip.click());

    expect(read(STORAGE_KEYS.progress).lessons['u1-l1']!.status).toBe('passed-with-assist');
  });

  it('drill mikro tidak dihitung sebagai percobaan', async () => {
    seedAttempts('u1-l1', 2, 'attempted');
    await renderLesson();
    await playLesson(false);

    expect(read(STORAGE_KEYS.progress).lessons['u1-l1']!.attempts).toBe(3);

    act(() => screen.getByText(/Drill 30 detik untuk/).click());
    typeCurrentDrill(false);
    await act(async () => {
      await Promise.resolve();
    });

    // Masih 3: bantuan bukan percobaan (dok. 04 §9).
    expect(read(STORAGE_KEYS.progress).lessons['u1-l1']!.attempts).toBe(3);
  });
});

describe('lesson yang tidak ada', () => {
  it('menjelaskan tanpa crash, dan tidak menghapus progres (R-22)', async () => {
    seedAttempts('u1-l1', 1, 'passed');
    await renderLesson('u9-hantu');

    expect(screen.getByText('Lesson tidak ditemukan')).toBeTruthy();
    expect(read(STORAGE_KEYS.progress).lessons['u1-l1']).toBeDefined();
  });
});
