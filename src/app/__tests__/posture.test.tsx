import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import PosturePage from '@/pages/PosturePage';
import HomePage from '@/pages/HomePage';
import { STORAGE_KEYS, _resetForTests, read, write } from '@/lib/storage';
import { hasSeenPosture, markPostureSeen } from '@/lib/storage/flags.ts';
import { defaultProgress } from '@/lib/storage/schema.ts';

/**
 * Panduan postur & anchoring (ADR-027).
 *
 * Halaman ini lahir dari kegagalan uji pemula, jadi yang dijaga di sini bukan
 * "halamannya ada", melainkan tiga hal yang kalau rusak membuatnya kembali tidak
 * berguna:
 *
 * 1. **Butir yang lahir dari kegagalan tetap ada** — telunjuk kanan di `j` bukan
 *    `h`, dan letak Backspace. Keduanya mudah hilang saat teksnya "dirapikan"
 *    menjadi panduan postur umum.
 * 2. **Jalan keluar terlihat sejak paint pertama** (dok. 02 §2: tidak ada tur).
 * 3. **Sekali tampil per perangkat**, dan pengguna lama tidak pernah disodori lagi.
 */

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

function renderPosture() {
  return render(
    <MemoryRouter initialEntries={['/posture']}>
      <Routes>
        <Route path="/posture" element={<PosturePage />} />
        <Route path="/learn/:lessonId" element={<p>layar sesi</p>} />
        <Route path="/learn" element={<p>daftar kurikulum</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('isi panduan', () => {
  it('menyebut kesalahan yang benar-benar teramati: telunjuk kanan di h, bukan j', () => {
    renderPosture();
    const warn = screen.getByText(/Periksa telunjuk kananmu/).closest('li')!;
    expect(warn.textContent).toContain('h');
    expect(warn.textContent).toContain('seluruh tangan kananmu bergeser satu tombol');
    // Dan menjelaskan kenapa `h` tetap sah sebagai tugas telunjuk — tanpa ini,
    // pengguna akan mengira `h` tombol terlarang.
    expect(warn.textContent).toContain('dijangkau');
  });

  it('menyebutkan letak Backspace supaya tidak dicari dengan mata', () => {
    renderPosture();
    const step = screen.getByText(/jangan cari dengan mata/).closest('li')!;
    expect(step.textContent).toContain('Backspace');
    expect(step.textContent).toContain('kelingking kanan');
  });

  it('menyebut tonjolan F dan J — cara menemukan posisi tanpa melihat', () => {
    renderPosture();
    expect(screen.getByText(/Raba tonjolannya/)).toBeTruthy();
  });
});

describe('urutan di layar', () => {
  it('keyboard mendahului teks langkah — umpan balik uji pemula kedua', () => {
    renderPosture();
    const keyboard = document.querySelector('.pg-keys')!;
    const langkahPertama = screen.getByText(/Duduk dulu, baru tangan/);
    expect(
      keyboard.compareDocumentPosition(langkahPertama) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe('bisa dilewati (dok. 02 §2)', () => {
  it('tombol lewati ada sebelum seluruh panduan dibaca, bukan di bawah', () => {
    renderPosture();
    const skip = screen.getByText('Lewati panduan');
    const steps = screen.getByText(/Duduk dulu, baru tangan/);
    // compareDocumentPosition: 4 = skip mendahului langkah pertama di DOM.
    expect(skip.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('melewati tetap mendarat di lesson pertama, bukan di jalan buntu', () => {
    renderPosture();
    act(() => screen.getByText('Lewati panduan').click());
    expect(screen.getByText('layar sesi')).toBeTruthy();
  });
});

describe('sekali tampil per perangkat', () => {
  it('membuka halaman menandainya sudah dilihat, tanpa menunggu tombol ditekan', () => {
    expect(hasSeenPosture()).toBe(false);
    renderPosture();
    expect(hasSeenPosture()).toBe(true);
  });

  it('tidak menimpa waktu kunjungan pertama saat dibuka lagi', () => {
    markPostureSeen(1000);
    renderPosture();
    expect(read(STORAGE_KEYS.meta).postureSeenAt).toBe(1000);
  });

  it('tidak merusak field meta lain', () => {
    const meta = read(STORAGE_KEYS.meta);
    write(STORAGE_KEYS.meta, { ...meta, streakDays: 4, longestStreak: 9 });
    renderPosture();
    const after = read(STORAGE_KEYS.meta);
    expect(after.streakDays).toBe(4);
    expect(after.longestStreak).toBe(9);
  });
});

describe('CTA beranda (dok. 02 §2)', () => {
  function renderHome() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('pengguna baru diarahkan ke panduan dulu', () => {
    renderHome();
    expect(screen.getByText('Mulai dari nol').getAttribute('href')).toBe('/posture');
  });

  it('yang sudah pernah melihat panduan langsung ke latihan', () => {
    markPostureSeen();
    renderHome();
    expect(screen.getByText('Mulai dari nol').getAttribute('href')).not.toBe('/posture');
  });

  it('pengguna yang sudah punya progres tidak pernah disodori panduan lagi', () => {
    const progress = defaultProgress();
    progress.lessons['u1-l1'] = {
      status: 'passed',
      attempts: 1,
      bestWpm: 20,
      bestAccuracy: 96,
      firstPassedAt: 1,
      lastAttemptAt: 1,
    };
    write(STORAGE_KEYS.progress, progress);

    renderHome();
    expect(screen.getByText('Lanjutkan').getAttribute('href')).not.toBe('/posture');
  });
});
