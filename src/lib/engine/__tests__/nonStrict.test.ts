import { describe, expect, it } from 'vitest';
import { applyBackspace, applyKey, createSession, finishSession } from '../session.ts';

/**
 * **Test karakterisasi mode non-strict** (dok. 02 §4: "karakter salah tidak
 * memblokir"). Kandidat ADR di dok. 10 "Backlog ide" mengusulkan menggantinya
 * dengan mode yang bisa dipilih pengguna — strict di `/learn`, non-strict di
 * `/practice`.
 *
 * **Test ini tidak menyatakan perilaku di bawah ini BENAR.** Ia mengunci apa
 * yang saat ini terjadi, supaya kalau mode strict jadi dikerjakan, test ini
 * berubah merah dan keputusannya terpaksa diambil dengan sadar — bukan
 * ketahuan berbulan-bulan kemudian lewat statistik yang aneh.
 *
 * Kalau kamu di sini karena test ini merah setelah menyentuh mode input:
 * itu memang tugasnya. Baca ADR-nya, lalu perbarui test ini dengan sengaja.
 *
 * Yang dikunci: engine ini **tidak punya model penyisipan**. Setiap karakter
 * tercetak mengonsumsi tepat satu sel target, jadi satu tombol BERLEBIH
 * menggeser seluruh sisa drill — dan setiap karakter sesudahnya tercatat salah
 * meski jarinya benar.
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
