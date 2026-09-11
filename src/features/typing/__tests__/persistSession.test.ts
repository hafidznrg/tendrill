import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionResult } from '@/lib/engine';
import { _resetForTests, flushPendingWrites, read, STORAGE_KEYS } from '@/lib/storage';
import { defaultKeystats } from '@/lib/storage/schema.ts';
import {
  localDateKey,
  mergeKeystats,
  persistSessionResult,
  previousBestFor,
  toSessionRecord,
} from '../persistSession.ts';

function makeResult(over: Partial<SessionResult> = {}): SessionResult {
  return {
    target: 'ff jj',
    durationMs: 12_345.6,
    grossWPM: 42.123,
    netWPM: 40.987,
    accuracy: 96.444,
    totalKeystrokes: 100,
    correctKeystrokes: 96,
    consistency: 0.8123,
    errorsByKey: {},
    latencyByKey: {},
    confusions: [],
    logOverflowed: false,
    completedAt: new Date('2026-09-11T10:00:00').getTime(),
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

describe('toSessionRecord', () => {
  it('menyimpan HASIL, bukan proses (dok. 05 §1 poin 3)', () => {
    const record = toSessionRecord(makeResult(), { source: 'lesson', lessonId: 'u1-l1' });

    expect(record.netWpm).toBe(40.99);
    expect(record.durationMs).toBe(12_346);
    expect(record.lessonId).toBe('u1-l1');
    // Tidak ada jejak log keystroke di dalam record.
    expect(JSON.stringify(record)).not.toContain('latency');
    expect(JSON.stringify(record)).not.toContain('confusion');
  });

  it('field opsional dihilangkan, bukan diisi undefined', () => {
    const record = toSessionRecord(makeResult(), { source: 'practice' });
    expect('lessonId' in record).toBe(false);
    expect('mode' in record).toBe(false);
  });
});

describe('mergeKeystats', () => {
  it('mengakumulasi attempts, errors, dan latensi per tombol', () => {
    const result = makeResult({
      errorsByKey: { e: 2 },
      latencyByKey: { e: { sumMs: 1000, count: 10 }, t: { sumMs: 500, count: 5 } },
    });
    const record = toSessionRecord(result, { source: 'lesson' });

    const first = mergeKeystats(defaultKeystats(), result, record);
    expect(first.keys['e']).toEqual({ attempts: 10, errors: 2, totalMs: 1000, slowCount: 0 });
    expect(first.keys['t']).toEqual({ attempts: 5, errors: 0, totalMs: 500, slowCount: 0 });

    // Sesi kedua menumpuk di atas yang pertama.
    const second = mergeKeystats(first, result, record);
    expect(second.keys['e']!.attempts).toBe(20);
    expect(second.keys['e']!.errors).toBe(4);
  });

  it('menandai tombol lambat untuk heatmap kelambatan (R-18)', () => {
    const result = makeResult({
      latencyByKey: { q: { sumMs: 5000, count: 10 } }, // 500 ms rata-rata
    });
    const merged = mergeKeystats(
      defaultKeystats(),
      result,
      toSessionRecord(result, { source: 'lesson' }),
    );
    expect(merged.keys['q']!.slowCount).toBe(1);
  });

  it('tombol yang salah tapi tidak punya data latensi tetap tercatat', () => {
    const result = makeResult({ errorsByKey: { z: 3 }, latencyByKey: {} });
    const merged = mergeKeystats(
      defaultKeystats(),
      result,
      toSessionRecord(result, { source: 'lesson' }),
    );
    expect(merged.keys['z']).toEqual({ attempts: 3, errors: 3, totalMs: 0, slowCount: 0 });
  });

  it('confusions diakumulasi dengan kunci "expected>actual"', () => {
    const result = makeResult({ confusions: [{ expected: 'e', actual: 'r', count: 4 }] });
    const merged = mergeKeystats(
      defaultKeystats(),
      result,
      toSessionRecord(result, { source: 'lesson' }),
    );
    expect(merged.confusions['e>r']).toBe(4);
  });

  it('agregat harian memakai rata-rata berbobot, bukan rata-rata dari rata-rata', () => {
    const a = makeResult({ netWPM: 20, accuracy: 90 });
    const b = makeResult({ netWPM: 40, accuracy: 100 });
    const recA = toSessionRecord(a, { source: 'lesson' });
    const recB = toSessionRecord(b, { source: 'lesson' });

    const after = mergeKeystats(mergeKeystats(defaultKeystats(), a, recA), b, recB);
    const day = after.daily[localDateKey(recA.at)]!;

    expect(day.sessions).toBe(2);
    expect(day.avgWpm).toBeCloseTo(30, 1);
    expect(day.avgAccuracy).toBeCloseTo(95, 1);
  });

  it('memakai tanggal LOKAL, bukan UTC', () => {
    // 11 Sep 2026 pukul 00:30 waktu lokal harus masuk tanggal 11, bukan 10.
    const at = new Date(2026, 8, 11, 0, 30).getTime();
    expect(localDateKey(at)).toBe('2026-09-11');
  });
});

describe('persistSessionResult', () => {
  it('tidak menulis seketika — penulisan dijadwalkan saat idle (R-20)', () => {
    persistSessionResult(makeResult(), { source: 'lesson', lessonId: 'u1-l1' });
    expect(localStorage.getItem(STORAGE_KEYS.sessions)).toBeNull();

    flushPendingWrites();
    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(1);
    expect(read(STORAGE_KEYS.keystats).daily).not.toEqual({});
  });

  it('previousBestFor mengambil WPM tertinggi untuk lesson itu saja', () => {
    persistSessionResult(makeResult({ netWPM: 30 }), { source: 'lesson', lessonId: 'u1-l1' });
    flushPendingWrites();
    persistSessionResult(makeResult({ netWPM: 45 }), { source: 'lesson', lessonId: 'u1-l1' });
    flushPendingWrites();
    persistSessionResult(makeResult({ netWPM: 99 }), { source: 'lesson', lessonId: 'u1-l2' });
    flushPendingWrites();

    expect(previousBestFor('u1-l1')?.netWpm).toBe(45);
    expect(previousBestFor('u9-l9')).toBeNull();
  });
});
