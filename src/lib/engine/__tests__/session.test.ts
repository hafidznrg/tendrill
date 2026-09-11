import { describe, expect, it } from 'vitest';
import {
  applyBackspace,
  applyKey,
  computeLiveMetrics,
  computeResult,
  createSession,
  finishSession,
  pause,
  restartSession,
  resume,
  VOID_THRESHOLD_MS,
} from '../index.ts';
import type { SessionState } from '../index.ts';

const COLS = 60;

/** Ketik sederet karakter dengan jeda seragam. Mengembalikan waktu terakhir. */
function type(s: SessionState, text: string, startMs = 1000, gapMs = 100): number {
  let t = startMs;
  for (const ch of text) {
    applyKey(s, ch, t);
    t += gapMs;
  }
  return t - gapMs;
}

describe('metrik (dok. 09 §2)', () => {
  it('0 keystroke → semua metrik 0, bukan NaN', () => {
    const s = createSession('hello', COLS);
    const m = computeLiveMetrics(s, 5000);
    expect(m.netWPM).toBe(0);
    expect(m.grossWPM).toBe(0);
    expect(m.accuracy).toBe(0);
    expect(Number.isNaN(m.netWPM)).toBe(false);
  });

  it('60 karakter benar dalam 60 detik → netWPM = 12', () => {
    const target = 'a'.repeat(60);
    const s = createSession(target, COLS);
    // 60 keystroke, jeda 1000 ms → keystroke pertama di t=0, terakhir di t=59000.
    // elapsed diukur keystroke pertama → terakhir, jadi 59 jeda.
    let t = 0;
    for (let i = 0; i < 60; i++) {
      applyKey(s, 'a', t);
      t += 1000;
    }
    const r = computeResult(s);
    expect(r.durationMs).toBe(59_000);
    expect(r.netWPM).toBeCloseTo((60 / 5 / 59) * 60, 5);
    expect(r.accuracy).toBe(100);
  });

  it('semua salah → akurasi 0, netWPM 0, grossWPM > 0', () => {
    const s = createSession('aaaa', COLS);
    type(s, 'bbbb');
    const r = computeResult(s);
    expect(r.accuracy).toBe(0);
    expect(r.netWPM).toBe(0);
    expect(r.grossWPM).toBeGreaterThan(0);
  });

  it('campuran benar/salah → akurasi sesuai hitungan manual', () => {
    const s = createSession('abcd', COLS);
    type(s, 'abxd');
    const r = computeResult(s);
    expect(r.totalKeystrokes).toBe(4);
    expect(r.correctKeystrokes).toBe(3);
    expect(r.accuracy).toBe(75);
  });

  it('backspace mengoreksi teks tetapi TIDAK menaikkan akurasi (ADR-003/019)', () => {
    const s = createSession('abcd', COLS);
    type(s, 'abx');
    applyBackspace(s);
    applyKey(s, 'c', 1400);
    applyKey(s, 'd', 1500);

    const r = computeResult(s);
    expect(r.accuracy).toBe(75); // 3 dari 4 percobaan pertama
    expect(r.totalKeystrokes).toBe(4); // percobaan ulang tidak ikut tercatat
    expect(s.cells[2]!.state).toBe('corrected');
  });

  it('mengetik ulang karakter yang tadinya benar tetap berstatus correct', () => {
    const s = createSession('ab', COLS);
    applyKey(s, 'a', 1000);
    applyBackspace(s);
    applyKey(s, 'a', 1100);
    expect(s.cells[0]!.state).toBe('correct');
  });

  it('konsistensi = 1 saat interval seragam, turun saat bervariasi', () => {
    const seragam = createSession('aaaaaaaa', COLS);
    type(seragam, 'aaaaaaaa', 0, 100);
    expect(computeResult(seragam).consistency).toBeCloseTo(1, 6);

    const bervariasi = createSession('aaaaaaaa', COLS);
    let t = 0;
    for (const gap of [50, 400, 60, 500, 45, 380, 70]) {
      applyKey(bervariasi, 'a', t);
      t += gap;
    }
    applyKey(bervariasi, 'a', t);
    const c = computeResult(bervariasi).consistency;
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(0.6);
  });
});

describe('input (dok. 09 §2)', () => {
  it('backspace di posisi 0 tidak melakukan apa-apa', () => {
    const s = createSession('abc', COLS);
    const o = applyBackspace(s);
    expect(o.accepted).toBe(false);
    expect(s.cursor).toBe(0);
  });

  it('mengetik setelah karakter terakhir diabaikan', () => {
    const s = createSession('ab', COLS);
    type(s, 'ab');
    expect(s.status).toBe('finished');
    const o = applyKey(s, 'c', 5000);
    expect(o.accepted).toBe(false);
    expect(s.cursor).toBe(2);
  });

  it('key yang bukan satu karakter diabaikan', () => {
    const s = createSession('abc', COLS);
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'ArrowLeft', 'F1']) {
      expect(applyKey(s, key, 1000).accepted).toBe(false);
    }
    expect(s.acc.total).toBe(0);
    expect(s.status).toBe('idle');
  });

  it('key repeat tercatat sebagai keystroke terpisah', () => {
    const s = createSession('aaa', COLS);
    // Menahan tombol adalah kesalahan mengetik yang nyata — tetap dihitung.
    type(s, 'aaa', 1000, 30);
    expect(s.acc.total).toBe(3);
  });

  it('dirty dipakai ulang: array yang sama, bukan alokasi baru', () => {
    const s = createSession('abc', COLS);
    const first = applyKey(s, 'a', 1000).dirty;
    const second = applyKey(s, 'b', 1100).dirty;
    expect(second).toBe(first);
    expect(second).toEqual([1]);
  });
});

describe('siklus hidup (dok. 09 §2)', () => {
  it('startedAt diisi pada keystroke pertama, bukan saat sesi dibuat', () => {
    const s = createSession('abc', COLS);
    expect(s.startedAt).toBeNull();
    expect(s.status).toBe('idle');
    applyKey(s, 'a', 4242);
    expect(s.startedAt).toBe(4242);
    expect(s.status).toBe('running');
  });

  it('otomatis finished setelah karakter terakhir', () => {
    const s = createSession('ab', COLS);
    applyKey(s, 'a', 1000);
    expect(s.status).toBe('running');
    const o = applyKey(s, 'b', 1100);
    expect(o.finished).toBe(true);
    expect(s.status).toBe('finished');
  });

  it('finished tetap tercapai walau karakter terakhir salah', () => {
    const s = createSession('ab', COLS);
    type(s, 'ax');
    expect(s.status).toBe('finished');
  });

  it('restart mengembalikan state ke idle bersih', () => {
    const s = createSession('abc', COLS);
    type(s, 'axc');
    const logBuffer = s.log.expectedCode;
    restartSession(s);

    expect(s.status).toBe('idle');
    expect(s.cursor).toBe(0);
    expect(s.startedAt).toBeNull();
    expect(s.acc.total).toBe(0);
    expect(s.log.count).toBe(0);
    expect(s.cells.every((c) => c.state === 'pending' && c.firstAttemptAt === null)).toBe(true);
    // Buffer dipakai ulang, bukan dialokasikan lagi.
    expect(s.log.expectedCode).toBe(logBuffer);
  });

  it('blur → paused; resume menambah pausedMs dan sesi tetap sah (R-05)', () => {
    const s = createSession('abcd', COLS);
    applyKey(s, 'a', 1000);
    applyKey(s, 'b', 1100);

    pause(s, 1200);
    expect(s.status).toBe('paused');
    resume(s, 61_200); // pergi satu menit
    expect(s.status).toBe('running');
    expect(s.pausedMs).toBe(60_000);

    applyKey(s, 'c', 61_300);
    applyKey(s, 'd', 61_400);

    expect(s.voided).toBe(false);
    const r = finishSession(s, 61_400);
    expect(r).not.toBeNull();
    // Waktu aktif 400 ms, bukan 60.400 ms.
    expect(r!.durationMs).toBe(400);
  });

  it('pause panjang tidak memicu void pada keystroke berikutnya', () => {
    const s = createSession('abcd', COLS);
    applyKey(s, 'a', 1000);
    pause(s, 1100);
    resume(s, 600_000);
    applyKey(s, 'b', 600_100);
    expect(s.voided).toBe(false);
    expect(s.acc.total).toBe(2);
  });

  it('jeda > 30 detik dengan fokus tetap ada → voided, hasil tidak disimpan (R-05)', () => {
    const s = createSession('abcd', COLS);
    applyKey(s, 'a', 1000);
    applyKey(s, 'b', 1100);

    const o = applyKey(s, 'c', 1100 + VOID_THRESHOLD_MS + 1);
    expect(o.accepted).toBe(false);
    expect(s.voided).toBe(true);
    expect(s.status).toBe('finished');
    expect(finishSession(s, 99_999)).toBeNull();
  });

  it('jeda tepat di ambang 30 detik belum membatalkan', () => {
    const s = createSession('abcd', COLS);
    applyKey(s, 'a', 1000);
    applyKey(s, 'b', 1000 + VOID_THRESHOLD_MS);
    expect(s.voided).toBe(false);
    expect(s.acc.total).toBe(2);
  });

  it('finishSession idempoten', () => {
    const s = createSession('ab', COLS);
    type(s, 'ab');
    const a = finishSession(s, 2000);
    const b = finishSession(s, 9000);
    expect(a).toBe(b);
    expect(s.endedAt).toBe(1100);
  });

  it('log yang mentok kapasitas → overflowed, metrik tetap benar (R-03)', () => {
    const s = createSession('ab', COLS);
    // Kapasitas = 2*2+64 = 68. Paksa melewatinya dengan backspace berulang,
    // karena hanya percobaan pertama yang dicatat (ADR-019).
    s.log.count = s.log.capacity;
    applyKey(s, 'a', 1000);
    applyKey(s, 'b', 1100);

    expect(s.log.overflowed).toBe(true);
    const r = computeResult(s);
    expect(r.logOverflowed).toBe(true);
    // Akumulator tidak ikut mentok, jadi angka utamanya tetap benar.
    expect(r.totalKeystrokes).toBe(2);
    expect(r.accuracy).toBe(100);
  });

  it('target string kosong → finished seketika, tidak crash', () => {
    const s = createSession('', COLS);
    expect(s.status).toBe('finished');
    const r = finishSession(s, 1000);
    expect(r).not.toBeNull();
    expect(r!.netWPM).toBe(0);
    expect(r!.accuracy).toBe(0);
    expect(r!.durationMs).toBe(0);
  });
});

describe('analisis error (dok. 09 §2)', () => {
  it('errorsByKey dihitung per karakter target, bukan yang diketik', () => {
    const s = createSession('eee', COLS);
    type(s, 'rrr');
    const r = computeResult(s);
    expect(r.errorsByKey).toEqual({ e: 3 });
    expect(r.errorsByKey['r']).toBeUndefined();
  });

  it('confusions mencatat pasangan (expected, actual)', () => {
    const s = createSession('eeet', COLS);
    type(s, 'rret');
    const r = computeResult(s);
    expect(r.confusions[0]).toEqual({ expected: 'e', actual: 'r', count: 2 });
  });

  it('spasi yang salah tercatat dengan benar', () => {
    const s = createSession('a b', COLS);
    type(s, 'axb');
    const r = computeResult(s);
    expect(r.errorsByKey[' ']).toBe(1);
    expect(r.confusions[0]).toEqual({ expected: ' ', actual: 'x', count: 1 });
  });

  it('latencyByKey mengakumulasi jeda ke tombol yang benar; tombol pertama tidak dihitung', () => {
    const s = createSession('abc', COLS);
    applyKey(s, 'a', 1000);
    applyKey(s, 'b', 1200); // jeda 200 → milik 'b'
    applyKey(s, 'c', 1500); // jeda 300 → milik 'c'

    const r = computeResult(s);
    expect(r.latencyByKey['a']).toBeUndefined();
    expect(r.latencyByKey['b']).toEqual({ sumMs: 200, count: 1 });
    expect(r.latencyByKey['c']).toEqual({ sumMs: 300, count: 1 });
  });

  it('latensi yang melintasi pause tidak ikut memuat waktu pause', () => {
    const s = createSession('ab', COLS);
    applyKey(s, 'a', 1000);
    pause(s, 1050);
    resume(s, 31_050); // 30 detik di tab lain
    applyKey(s, 'b', 31_150);

    const r = computeResult(s);
    expect(r.latencyByKey['b']).toEqual({ sumMs: 150, count: 1 });
  });
});

describe('waktu (dok. 09 §2, R-04)', () => {
  it('metrik live beku selama paused', () => {
    const s = createSession('abcd', COLS);
    applyKey(s, 'a', 1000);
    applyKey(s, 'b', 2000);
    pause(s, 2500);

    const saatPause = computeLiveMetrics(s, 2500);
    const jauhKemudian = computeLiveMetrics(s, 600_000);
    expect(jauhKemudian.elapsedMs).toBe(saatPause.elapsedMs);
    expect(jauhKemudian.netWPM).toBe(saatPause.netWPM);
  });

  it('metrik live pada keystroke terakhir identik dengan hasil akhir', () => {
    const s = createSession('halo dunia', COLS);
    const last = type(s, 'halo dunia', 500, 120);
    const live = computeLiveMetrics(s, last);
    const r = computeResult(s);

    expect(live.elapsedMs).toBe(r.durationMs);
    expect(live.netWPM).toBeCloseTo(r.netWPM, 10);
    expect(live.accuracy).toBeCloseTo(r.accuracy, 10);
  });
});
