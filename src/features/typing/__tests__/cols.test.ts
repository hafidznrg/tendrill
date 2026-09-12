import { describe, expect, it } from 'vitest';
import { applyKey, createSession, rewrapSession, wrapText } from '@/lib/engine';
import { FALLBACK_COLS, MAX_COLS, MIN_COLS, colsFor } from '../cols.ts';

/**
 * Lebar baris diukur, bukan dikonstankan (ADR-028).
 *
 * Bug yang dijaga di sini nyata dan sempat tayang: `COLS = 52` pada kotak 720 px
 * yang hanya memuat 50 kolom. Browser memotong dua karakter sisanya ke baris
 * berikutnya, `lineStarts` tidak tahu apa-apa soal potongan itu, dan caret
 * tergambar satu baris di atas posisi sebenarnya.
 *
 * jsdom tidak punya layout, jadi test ini **tidak bisa** membuktikan browser
 * berhenti memotong — itu hanya bisa diperiksa di browser sungguhan, dan sudah.
 * Yang bisa dijaga di sini: aritmetikanya, dan janji bahwa membungkus ulang
 * tidak menghapus ketikan siapa pun.
 */

describe('colsFor', () => {
  it('memakai lebar kotak yang sebenarnya — 720 px / 14,4 px = 50, bukan 52', () => {
    // Angka persis dari lebar default aplikasi: max-w-3xl (768) − px-6 (2×24).
    expect(colsFor(720, 14.4)).toBe(50);
  });

  it('membulatkan ke BAWAH — kolom yang setengah muat tidak muat', () => {
    expect(colsFor(719, 14.4)).toBe(49);
    expect(colsFor(734, 14.4)).toBe(50);
  });

  it('tidak pernah melebihi 60 karakter (dok. 07 §2)', () => {
    expect(colsFor(4000, 14.4)).toBe(MAX_COLS);
  });

  it('tidak pernah turun di bawah batas yang masih bisa diketik', () => {
    expect(colsFor(60, 14.4)).toBe(MIN_COLS);
  });

  it('jatuh ke nilai aman selama pengukuran belum ada', () => {
    // Ini keadaan sebelum `document.fonts.ready`: sesi memang belum aktif, tapi
    // angkanya tetap tidak boleh 0 atau NaN.
    expect(colsFor(0, 0)).toBe(FALLBACK_COLS);
    expect(colsFor(720, 0)).toBe(FALLBACK_COLS);
    expect(colsFor(Number.NaN, 14.4)).toBe(FALLBACK_COLS);
  });

  it('hasilnya SELALU muat di kotaknya — invarian yang dilanggar konstanta 52', () => {
    for (let width = 200; width <= 2000; width += 7) {
      for (const charWidth of [10, 12.5, 14.4, 18, 21.6]) {
        const cols = colsFor(width, charWidth);
        // Satu-satunya pengecualian yang disengaja: kotak yang lebih sempit
        // daripada MIN_COLS karakter. Di situ teks memang meluber, dan `pre`
        // membuatnya terpotong di tepi — kelihatan, dan caret tetap benar.
        if (cols === MIN_COLS) continue;
        expect(cols * charWidth).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe('rewrapSession (ADR-028)', () => {
  const TARGET = 'ff jj ff jj fj jf ff jj fj jf ff jj fj jf ff jj';

  it('menghitung ulang batas baris untuk lebar baru', () => {
    const s = createSession(TARGET, 50);
    expect(s.lineStarts).toEqual(wrapText(TARGET, 50));

    rewrapSession(s, 20);
    expect(s.lineStarts).toEqual(wrapText(TARGET, 20));
    expect(s.lineStarts.length).toBeGreaterThan(1);
  });

  it('TIDAK menghapus ketikan — ini seluruh alasan fungsi ini ada', () => {
    const s = createSession(TARGET, 50);
    applyKey(s, 'f', 1000);
    applyKey(s, 'f', 1200);
    applyKey(s, 'x', 1400); // sengaja salah

    rewrapSession(s, 24);

    expect(s.cursor).toBe(3);
    expect(s.status).toBe('running');
    expect(s.acc.total).toBe(3);
    expect(s.acc.correct).toBe(2);
    expect(s.cells[0]!.state).toBe('correct');
    expect(s.cells[2]!.state).toBe('incorrect');
    expect(s.log.count).toBe(3);
  });

  it('lebar tidak masuk akal diabaikan, bukan melahirkan baris kosong', () => {
    const s = createSession(TARGET, 50);
    const before = [...s.lineStarts];
    rewrapSession(s, 0);
    rewrapSession(s, -10);
    expect(s.lineStarts).toEqual(before);
  });

  it('membungkus ulang ke lebar yang sama tidak mengubah apa pun', () => {
    const s = createSession(TARGET, 50);
    const before = [...s.lineStarts];
    rewrapSession(s, 50);
    expect(s.lineStarts).toEqual(before);
  });
});

describe('wrapText tidak pernah melebihi cols (dasar seluruh perbaikan ini)', () => {
  it.each([20, 33, 50, 52, 60])('cols = %i', (cols) => {
    const target =
      'the quick brown fox jumps over the lazy dog and then it runs back again to rest';
    const starts = wrapText(target, cols);
    for (let i = 0; i < starts.length; i++) {
      const from = starts[i]!;
      const to = starts[i + 1] ?? target.length;
      // Baris boleh berakhir dengan spasi yang menggantung (dok. 03 §8), jadi
      // yang diperiksa adalah panjang TANPA spasi ujung itu.
      expect(target.slice(from, to).trimEnd().length).toBeLessThanOrEqual(cols);
    }
  });
});
