import { describe, expect, it } from 'vitest';
import {
  applyBackspace,
  applyKey,
  createSession,
  finishSession,
  setInputMode,
} from '../session.ts';

/**
 * **Dua mode input, berdampingan** (ADR-029).
 *
 * Berkas ini lahir sebagai test karakterisasi non-strict, dipasang supaya
 * berubah merah begitu keputusan mode diambil. Keputusannya sudah diambil
 * (2026-09-12): **strict menjadi default di `/learn`, non-strict tetap ada dan
 * menjadi default di `/practice`, dan pengguna bebas mengganti keduanya.**
 *
 * Karena itu bagian non-strict di bawah **tetap hijau, dan itu benar** — ia
 * bukan sisa yang lupa diperbarui. Yang berubah bukan perilaku non-strict,
 * melainkan siapa yang memakainya.
 *
 * ⚠️ **Jangan membaca berkas ini sebagai "jadi `/learn` non-strict".** Engine
 * sengaja netral: `createSession` tanpa opsi = non-strict, dan yang memilih
 * default per halaman adalah UI (`readInputMode`), karena itu keputusan produk.
 *
 * Yang dijaga di sini:
 * 1. Perilaku non-strict, apa adanya, termasuk kerusakan yang ia sebabkan —
 *    itulah alasan strict dipilih untuk `/learn`.
 * 2. Perilaku strict, dan bahwa kerusakan yang sama **mustahil** terjadi di sana.
 * 3. Bahwa keduanya mencatat kesalahan dengan cara yang sama (ADR-003 & ADR-019
 *    tidak berubah): menahan tanpa mencatat akan membuat akurasi selalu 100%.
 */

const TARGET = 'ff jj';

/** Ketik satu per satu dengan jarak tetap, supaya latensinya tidak ikut diuji. */
function type(s: ReturnType<typeof createSession>, keys: string[], startAt = 1000): void {
  keys.forEach((key, i) => {
    applyKey(s, key, startAt + i * 200);
  });
}

describe('non-strict: kursor maju walau salah (dok. 02 §4)', () => {
  it('karakter salah tidak memblokir — kursor tetap maju', () => {
    const s = createSession(TARGET, 40);

    applyKey(s, 'x', 1000); // salah di posisi 0

    expect(s.cursor).toBe(1);
    expect(s.cells[0]!.state).toBe('incorrect');
    // Inilah inti mode non-strict: pengguna boleh terus, bukan tertahan.
    expect(s.status).toBe('running');
  });
});

describe('satu tombol berlebih merusak sisa drill', () => {
  it('jari yang benar sesudah pergeseran tetap tercatat salah', () => {
    const s = createSession(TARGET, 40);

    // 'f', 'f', lalu 'f' BERLEBIH, lalu pengguna melanjutkan dengan benar
    // menurut niatnya sendiri: spasi, 'j', 'j'.
    type(s, ['f', 'f', 'f', ' ', 'j', 'j']);

    expect(s.cells.map((c) => c.state)).toEqual([
      'correct', // f
      'correct', // f
      'incorrect', // 'f' padahal spasi — SATU kesalahan jari yang sesungguhnya
      'incorrect', // spasi padahal 'j' — jarinya benar, catatannya salah
      'correct', // 'j' padahal 'j' — kebetulan cocok lagi
    ]);

    const r = finishSession(s, 3000)!;

    // Satu kesalahan jari menjadi DUA catatan salah. Pada drill 500 karakter,
    // pergeseran di awal bisa merusak seluruh sisanya.
    expect(r.accuracy).toBe(60); // 3 dari 5, bukan 80
  });

  it('data diagnosis ikut tercemar, bukan hanya angka akurasi', () => {
    const s = createSession(TARGET, 40);
    type(s, ['f', 'f', 'f', ' ', 'j', 'j']);
    const r = finishSession(s, 3000)!;

    // Diagnosis (ADR-011) dan heatmap error (R-18) membaca dari sini. Spasi
    // tercatat bermasalah padahal pengguna tidak pernah salah menekan spasi —
    // yang salah adalah 'f' berlebih sebelumnya.
    expect(r.errorsByKey).toHaveProperty(' ');
    expect(r.errorsByKey).toHaveProperty('j');
    expect(r.confusions.some((c) => c.expected === 'j' && c.actual === ' ')).toBe(true);
  });
});

describe('backspace memperbaiki keselarasan, bukan akurasi (ADR-019)', () => {
  it('mundur lalu ketik ulang menyelamatkan sisa drill', () => {
    const s = createSession(TARGET, 40);

    type(s, ['f', 'f', 'f']); // 'f' berlebih di posisi 2
    applyBackspace(s); // pengguna SADAR dan mundur
    type(s, [' ', 'j', 'j'], 2000);

    // Sisa drill selamat: hanya sel 2 yang rusak.
    expect(s.cells.map((c) => c.state)).toEqual([
      'correct',
      'correct',
      'corrected', // pernah salah, sekarang benar
      'correct',
      'correct',
    ]);

    const r = finishSession(s, 4000)!;
    // Tetap 80%, bukan 100%: error yang sudah tercatat tidak bisa dihapus
    // (ADR-003). Yang diselamatkan backspace adalah KESELARASAN, bukan nilai.
    expect(r.accuracy).toBe(80);
  });

  it('untuk memakai backspace, pengguna harus SADAR ia bergeser', () => {
    // Dua sesi identik dari sudut pandang jari — bedanya hanya apakah
    // pengguna sempat melihat layar dan menyadari pergeserannya.
    const sadar = createSession(TARGET, 40);
    type(sadar, ['f', 'f', 'f']);
    applyBackspace(sadar);
    type(sadar, [' ', 'j', 'j'], 2000);

    const tidakSadar = createSession(TARGET, 40);
    type(tidakSadar, ['f', 'f', 'f', ' ', 'j', 'j']);

    const a = finishSession(sadar, 4000)!;
    const b = finishSession(tidakSadar, 4000)!;

    // Selisih 20 poin akurasi dari kesalahan jari yang PERSIS SAMA. Satu-satunya
    // pembeda: melihat ke layar — kebalikan dari yang diajarkan aplikasi ini.
    // Ketimpangan inilah yang menjadi alasan utama kandidat ADR mode strict.
    expect(a.accuracy).toBe(80);
    expect(b.accuracy).toBe(60);
  });
});


// ---------------------------------------------------------------------------

describe('strict: tombol salah MENAHAN kursor (ADR-029)', () => {
  const strict = () => createSession(TARGET, 40, { strict: true });

  it('kursor tidak maju, dan selnya ditandai salah', () => {
    const s = strict();

    const outcome = applyKey(s, 'x', 1000);

    expect(outcome.accepted).toBe(true);
    // Inilah seluruh isi mode ini: diterima, dicatat, TAPI tidak memajukan apa pun.
    expect(outcome.cursorMoved).toBe(false);
    expect(s.cursor).toBe(0);
    expect(s.cells[0]!.state).toBe('incorrect');
    expect(s.status).toBe('running');
  });

  it('kesalahan tetap DICATAT — menahan tanpa mencatat membuat akurasi palsu', () => {
    const s = strict();
    type(s, ['x', 'f', 'f', ' ', 'j', 'j']);

    const r = finishSession(s, 4000)!;
    expect(r.totalKeystrokes).toBe(5);
    expect(r.correctKeystrokes).toBe(4);
    expect(r.accuracy).toBe(80);
    expect(r.errorsByKey['f']).toBe(1);
    expect(r.confusions.some((c) => c.expected === 'f' && c.actual === 'x')).toBe(true);
  });

  it('sel yang sempat salah berakhir "corrected", bukan "correct" (ADR-003)', () => {
    const s = strict();
    type(s, ['x', 'f', 'f', ' ', 'j', 'j']);
    expect(s.cells[0]!.state).toBe('corrected');
  });

  it('menekan salah berkali-kali di sel yang sama hanya dihitung sekali (ADR-019)', () => {
    const s = strict();
    type(s, ['x', 'y', 'z', 'q', 'f']);

    const r = finishSession(s, 4000)!;
    // Satu kesalahan, bukan empat: menghukum orang yang terus mencoba lebih
    // berat daripada yang menyerah tidak masuk akal.
    expect(r.totalKeystrokes).toBe(1);
    expect(r.accuracy).toBe(0);
    expect(s.cursor).toBe(1);
  });

  it('PERGESERAN MUSTAHIL — inilah alasan strict dipilih untuk /learn', () => {
    // Aliran jari yang PERSIS SAMA dengan kasus non-strict di atas: satu 'f'
    // berlebih, lalu pengguna melanjutkan menurut niatnya sendiri.
    const s = strict();
    type(s, ['f', 'f', 'f', ' ', 'j', 'j']);

    // Di non-strict, ini menghasilkan 60% dan mencemari diagnosis spasi & 'j'.
    const r = finishSession(s, 4000)!;
    expect(r.accuracy).toBe(80); // 4 dari 5 — hanya kesalahan yang SUNGGUHAN
    expect(s.cells.map((c) => c.state)).toEqual([
      'correct',
      'correct',
      'corrected', // 'f' berlebih tertahan di sini sampai spasi ditekan
      'correct',
      'correct',
    ]);
    // Dan yang paling penting: spasi & 'j' tidak ikut tertuduh.
    expect(r.errorsByKey).not.toHaveProperty('j');
    expect(r.confusions.some((c) => c.expected === 'j')).toBe(false);
  });

  it('mode bisa diganti di tengah sesi tanpa kehilangan apa pun', () => {
    const s = strict();
    type(s, ['f', 'f']);

    setInputMode(s, false); // pengguna menekan sakelar
    applyKey(s, 'x', 3000); // sekarang salah pun lewat

    expect(s.cursor).toBe(3);
    expect(s.acc.total).toBe(3);
    expect(s.cells[0]!.state).toBe('correct');

    setInputMode(s, true);
    applyKey(s, 'q', 3200);
    expect(s.cursor).toBe(3); // tertahan lagi
  });
});
