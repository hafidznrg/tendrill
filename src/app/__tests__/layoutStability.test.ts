import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Penjaga "nol layout shift" untuk sumber yang paling tidak terduga: scrollbar.
 *
 * Saat layar hasil muncul di akhir sesi, halaman melewati tinggi layar dan
 * scrollbar lahir. Tanpa gutter yang dipesan sejak awal, lahirnya scrollbar
 * MENYEMPITKAN viewport, dan seluruh isi halaman yang di-`mx-auto` bergeser ke
 * kiri. Diukur di Chromium 2026-09-11: **−7,6 px**, nol setelah diperbaiki.
 *
 * **Kenapa ini asersi teks, bukan asersi layout.** jsdom tidak punya mesin
 * layout dan tidak mengenal scrollbar sama sekali, jadi tidak ada cara menguji
 * akibatnya di Vitest. Yang bisa dijaga hanyalah sebabnya: baris CSS-nya masih
 * ada. Itu memang lemah — ia menangkap penghapusan tidak sengaja, dan tidak
 * lebih. Pengukuran sesungguhnya tetap milik dok. 09 §5 poin caret/layout shift.
 */

// Dibaca lewat cwd, bukan `import.meta.url`: di lingkungan jsdom URL modul
// berskema http, dan `fileURLToPath` menolaknya.
const CSS = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('stabilitas lebar halaman (dok. 07 §1 poin 2)', () => {
  it('html memesan ruang scrollbar sejak awal', () => {
    const htmlBlock = /html\s*\{([^}]*)\}/.exec(CSS);
    expect(htmlBlock, 'blok `html { … }` hilang dari styles.css').not.toBeNull();
    expect(htmlBlock![1]).toMatch(/scrollbar-gutter:\s*stable/);
  });
});
