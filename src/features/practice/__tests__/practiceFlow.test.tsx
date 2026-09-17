import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import PracticePage from '@/pages/PracticePage';
import { STORAGE_KEYS, _resetForTests, read } from '@/lib/storage';
// Diimpor statis DI TEST saja: `PracticePage` sendiri memuatnya lewat `import()`
// dinamis (ADR-032), dan di jsdom modul yang belum pernah dimuat butuh putaran
// event loop nyata — bukan waktu palsu. Mengimpornya di sini membuat `import()`
// halaman selesai di microtask, tanpa mengubah apa pun di kode produksi.
import '@/data/wordlists/en';

/**
 * Alur `/practice` dari ujung ke ujung (dok. 08 Fase 5 DoD).
 *
 * DoD-nya dua baris, dan keduanya mudah dinyatakan benar dengan melihat layar
 * sekali: "mode timer berhenti tepat waktu" dan "sumber teks dimuat lazy".
 * Yang kedua dijaga `scripts/check-chunk-graph.ts` di keluaran build — sumber
 * saja tidak cukup membuktikannya (ADR-031). Yang pertama dijaga di sini,
 * **dengan kontrol negatif**: kalau sesi berakhir sebelum waktunya, test ini
 * harus merah sebelum ambangnya, bukan hanya hijau sesudahnya.
 *
 * `useCharMetrics` di-mock dengan alasan yang sama seperti `learnFlow`: jsdom
 * tidak pernah mengukur lebar apa pun, dan tanpa metrik siap input memang
 * sengaja dimatikan.
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

function click(name: RegExp): void {
  act(() => {
    screen.getByRole('button', { name }).click();
  });
}

/** Ketik `count` karakter pertama dari target, satu per 100 ms waktu palsu. */
function typeSome(count: number): void {
  const target = currentTarget();
  for (let i = 0; i < count && i < target.length; i++) {
    press(target[i]!);
    act(() => {
      vi.advanceTimersByTime(100);
    });
  }
}

async function startSession(duration: RegExp): Promise<void> {
  render(
    <MemoryRouter>
      <PracticePage />
    </MemoryRouter>,
  );
  click(duration);
  click(/Mulai latihan/);
  // `begin()` menunggu `import()` wordlist — tanpa ini, panggung belum ada.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
}

beforeEach(() => {
  // `_resetForTests()` membersihkan modulnya, BUKAN `localStorage` — tanpa baris
  // kedua, riwayat test sebelumnya ikut terbawa dan jumlah barisnya bertambah.
  localStorage.clear();
  _resetForTests();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mode timer berhenti tepat waktu (dok. 08 Fase 5 DoD)', () => {
  it('sesi 15 detik masih berjalan di detik ke-14 dan berakhir sesudah 15', async () => {
    await startSession(/15 detik/);

    // Teksnya sengaja lebih panjang daripada yang bisa diketik dalam 15 detik
    // (ADR-032) — kalau tidak, yang mengakhiri sesi adalah teksnya, bukan timer.
    // Sedikit di bawah 250 karena generator berhenti di batas kata.
    expect(currentTarget().length).toBeGreaterThan(230);

    typeSome(5);

    // Kontrol negatif: sebelum ambangnya, layar hasil TIDAK boleh ada.
    act(() => {
      vi.advanceTimersByTime(13_400);
    });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1_200);
    });
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('"sampai selesai" tidak punya timer sama sekali', async () => {
    await startSession(/sampai selesai/);
    expect(currentTarget().length).toBeLessThanOrEqual(240);

    typeSome(3);
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    // Dua menit berlalu tanpa satu pun timer yang mengakhiri sesi: mode ini
    // berakhir hanya kalau teksnya habis. (Ambang void 30 detik baru menyala
    // pada keystroke BERIKUTNYA — dok. 03 §5 — jadi ia tidak muncul di sini.)
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });
});

describe('hasil latihan bebas', () => {
  it('tersimpan sebagai sesi practice bermode, tanpa menyentuh progres kurikulum', async () => {
    await startSession(/15 detik/);
    typeSome(20);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    const { items } = read(STORAGE_KEYS.sessions);
    expect(items).toHaveLength(1);
    expect(items[0]!.source).toBe('practice');
    expect(items[0]!.mode).toBe('15s');
    expect(items[0]!.lessonId).toBeUndefined();
    // Dinilai atas 15 detik penuh, bukan atas 2 detik yang benar-benar diketik
    // (ADR-032). Kalau ini ~2000, WPM-nya melonjak tujuh kali lipat.
    expect(items[0]!.durationMs).toBe(15_000);

    // Bilah metrik dibekukan di titik yang sama dengan layar hasil — kalau tidak,
    // layar memperlihatkan dua WPM sekaligus (terlihat di browser: 1039 vs 1,6).
    const shownWpm = document.querySelectorAll('.lm-value')[1]?.textContent;
    expect(shownWpm).toBe(`${Math.round(items[0]!.netWpm)}`);

    // Latihan bebas tidak pernah membuka atau menutup lesson (dok. 02 §6).
    expect(read(STORAGE_KEYS.progress).lessons).toEqual({});
    // Tetapi ia MEMANG membentuk statistik tombol — itu justru gunanya.
    expect(Object.keys(read(STORAGE_KEYS.keystats).keys).length).toBeGreaterThan(0);
  });

  it('muncul di riwayat setelah kembali ke pilihan', async () => {
    await startSession(/15 detik/);
    typeSome(20);
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    click(/keluar|kembali/i);
    expect(screen.getByRole('table')).toBeInTheDocument();
    // header + 1 sesi. Kalau ini 3, `onFinish` menyimpan dua kali.
    expect(screen.getAllByRole('row').length).toBe(2);
  });
});

describe('mode input', () => {
  it('default non-strict di /practice (ADR-029)', async () => {
    await startSession(/15 detik/);
    expect(screen.getByRole('button', { name: /^Mode bebas/ })).toBeInTheDocument();
  });
});
