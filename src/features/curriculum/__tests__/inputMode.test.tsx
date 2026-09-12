import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import LessonPage from '@/pages/LessonPage';
import { STORAGE_KEYS, _resetForTests, read, write } from '@/lib/storage';
import { readInputMode, writeInputMode } from '@/lib/storage/flags.ts';
import { DEFAULT_INPUT_MODE } from '@/lib/storage/schema.ts';

/**
 * Mode input yang bisa dipilih pengguna (ADR-029).
 *
 * Yang dijaga di sini adalah janji-janji ADR-nya, bukan sekadar "tombolnya ada":
 * default per halaman, pilihan yang **bertahan** ke lesson berikutnya, mode yang
 * terlihat **tanpa membuka pengaturan**, dan — yang paling mudah rusak diam-diam —
 * bahwa mode strict benar-benar menahan kursor di layar sesi sungguhan.
 */
vi.mock('@/features/typing/hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, width: 520, ready: true }),
}));

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function currentTarget(): string {
  return document.querySelector('.ta-text')?.textContent ?? '';
}

async function renderLesson(): Promise<void> {
  render(
    <MemoryRouter initialEntries={['/learn/u1-l1']}>
      <Routes>
        <Route path="/learn/:lessonId" element={<LessonPage />} />
        <Route path="/learn" element={<p>daftar kurikulum</p>} />
      </Routes>
    </MemoryRouter>,
  );
  for (let i = 0; i < 20; i++) {
    if (currentTarget().length > 0) break;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

describe('default per halaman (dok. 02 §4)', () => {
  it('strict di /learn, non-strict di /practice', () => {
    expect(DEFAULT_INPUT_MODE).toEqual({ learn: 'strict', practice: 'non-strict' });
    expect(readInputMode('learn')).toBe('strict');
    expect(readInputMode('practice')).toBe('non-strict');
  });

  it('nilai yang rusak di localStorage jatuh ke default, bukan mematikan layar', () => {
    const settings = read(STORAGE_KEYS.settings);
    write(STORAGE_KEYS.settings, {
      ...settings,
      inputMode: { learn: 'ngawur', practice: null } as never,
    });
    expect(readInputMode('learn')).toBe('strict');
    expect(readInputMode('practice')).toBe('non-strict');
  });

  it('mengganti satu halaman tidak menyentuh halaman lain', () => {
    writeInputMode('learn', 'non-strict');
    expect(readInputMode('learn')).toBe('non-strict');
    expect(readInputMode('practice')).toBe('non-strict');

    writeInputMode('practice', 'strict');
    expect(readInputMode('learn')).toBe('non-strict');
    expect(readInputMode('practice')).toBe('strict');
  });

  it('tidak merusak setelan lain saat menulis', () => {
    const settings = read(STORAGE_KEYS.settings);
    write(STORAGE_KEYS.settings, { ...settings, theme: 'dark', soundEnabled: true });
    writeInputMode('learn', 'non-strict');

    const after = read(STORAGE_KEYS.settings);
    expect(after.theme).toBe('dark');
    expect(after.soundEnabled).toBe(true);
  });
});

describe('di layar sesi', () => {
  it('mode terlihat tanpa membuka pengaturan (ADR-029 aturan 1)', async () => {
    await renderLesson();
    expect(screen.getByText('strict')).toBeTruthy();
  });

  it('strict MENAHAN kursor — karakter salah tidak memajukan apa pun', async () => {
    await renderLesson();
    const target = currentTarget();
    const salah = target[0] === 'f' ? 'j' : 'f';

    press(salah);
    press(salah);

    const spans = document.querySelectorAll('.ta-text span');
    expect(spans[0]!.className).toBe('ta-incorrect');
    // Sel kedua belum tersentuh sama sekali: kursor memang tidak pindah.
    expect(spans[1]!.className).toBe('ta-pending');

    press(target[0]!);
    expect(spans[0]!.className).toBe('ta-corrected');
  });

  it('mengganti ke bebas membuat karakter salah lewat lagi', async () => {
    await renderLesson();
    act(() => screen.getByText('strict').closest('button')!.click());

    const target = currentTarget();
    const salah = target[0] === 'f' ? 'j' : 'f';
    press(salah);

    const spans = document.querySelectorAll('.ta-text span');
    expect(spans[0]!.className).toBe('ta-incorrect');
    // Kursor maju: sel berikutnya kini yang ditunggu.
    press(target[1]!);
    expect(spans[1]!.className).not.toBe('ta-pending');
  });

  it('pilihannya BERTAHAN — tersimpan, bukan hanya untuk sesi ini', async () => {
    await renderLesson();
    act(() => screen.getByText('strict').closest('button')!.click());

    expect(screen.getByText('bebas')).toBeTruthy();
    expect(readInputMode('learn')).toBe('non-strict');
  });

  it('lesson berikutnya membuka dengan mode yang sudah dipilih', async () => {
    writeInputMode('learn', 'non-strict');
    await renderLesson();

    expect(screen.getByText('bebas')).toBeTruthy();
    const target = currentTarget();
    press(target[0] === 'f' ? 'j' : 'f');
    expect(document.querySelectorAll('.ta-text span')[0]!.className).toBe('ta-incorrect');
    press(target[1]!);
    expect(document.querySelectorAll('.ta-text span')[1]!.className).not.toBe('ta-pending');
  });

  it('mengganti mode di tengah drill tidak menghapus ketikan', async () => {
    await renderLesson();
    const target = currentTarget();
    press(target[0]!);
    press(target[1]!);

    act(() => screen.getByText('strict').closest('button')!.click());

    const spans = document.querySelectorAll('.ta-text span');
    expect(spans[0]!.className).toBe('ta-correct');
    expect(spans[1]!.className).toBe('ta-correct');
  });

  it('sakelar melepas fokus supaya spasi berikutnya masuk ke drill', async () => {
    await renderLesson();
    const button = screen.getByText('strict').closest('button')!;
    act(() => button.click());
    expect(document.activeElement).not.toBe(button);
  });
});
