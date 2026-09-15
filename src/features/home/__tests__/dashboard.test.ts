import { describe, expect, it } from 'vitest';
import { lessons } from '@/data/curriculum/en/index.ts';
import { units } from '@/data/curriculum/en/units.ts';
import { nextLessonId } from '@/features/curriculum/progress.ts';
import { localDateKey } from '@/features/typing/persistSession.ts';
import { defaultProgress, type DailyStat } from '@/lib/storage/schema.ts';
import { nextLessonCard, sparklinePoints, weekSummary } from '../dashboard.ts';

/** Dashboard beranda (ADR-039). Tiap asersi nol punya kasus berisi di sebelahnya. */

const NOW = new Date(2026, 8, 15, 10).getTime();
const day = (offset: number) => localDateKey(new Date(2026, 8, 15 - offset, 12).getTime());
const stat = (avgWpm: number): DailyStat => ({
  sessions: 1,
  ms: 60000,
  avgWpm,
  avgAccuracy: 96,
});

describe('nextLessonCard', () => {
  it('pengguna baru: lesson pertama Unit 1, nol lulus', () => {
    const progress = defaultProgress();
    const card = nextLessonCard(progress, lessons, units, nextLessonId(progress, lessons));
    expect(card.lesson?.id).toBe('u1-l1');
    expect(card.position).toBe(1);
    expect(card.passedCount).toBe(0);
    expect(card.totalCount).toBe(36);
    expect(card.segments).toHaveLength(6);
    expect(card.best).toBeNull();
  });

  it('menghitung lulus per unit dan percobaan terbaik lesson berikutnya', () => {
    const progress = defaultProgress();
    const entry = (status: 'passed' | 'attempted') => ({
      status,
      attempts: 1,
      bestWpm: 23,
      bestAccuracy: 96.2,
      firstPassedAt: status === 'passed' ? 1 : null,
      lastAttemptAt: 1,
    });
    progress.lessons['u1-l1'] = entry('passed');
    progress.lessons['u1-l2'] = entry('attempted');
    const card = nextLessonCard(progress, lessons, units, nextLessonId(progress, lessons));
    expect(card.lesson?.id).toBe('u1-l2');
    expect(card.position).toBe(2);
    expect(card.passedCount).toBe(1);
    expect(card.segments[0]).toMatchObject({ unitId: 'u1', passed: 1 });
    expect(card.best).toEqual({ wpm: 23, accuracy: 96.2 });
  });

  it('kurikulum selesai: lesson null, bukan error', () => {
    const card = nextLessonCard(defaultProgress(), lessons, units, null);
    expect(card.lesson).toBeNull();
    expect(card.criteria).toBeNull();
  });
});

describe('weekSummary', () => {
  it('tanpa data: nol, bukan NaN', () => {
    const w = weekSummary({}, NOW);
    expect(w.wpm).toHaveLength(7);
    expect(w.meanWpm).toBeNull();
    expect(w.practiced).toBe(0);
  });

  it('rata-rata hanya dari hari berlatih; beruntun dari stats', () => {
    const w = weekSummary({ [day(0)]: stat(24), [day(1)]: stat(20), [day(4)]: stat(19) }, NOW);
    expect(w.practiced).toBe(3);
    expect(w.meanWpm).toBe(21);
    expect(w.streak).toBe(2);
    expect(w.wpm[6]).toBe(24);
    expect(w.wpm[5]).toBe(20);
    expect(w.wpm[0]).toBeNull();
  });
});

describe('sparklinePoints', () => {
  it('melewati hari kosong dan tetap di dalam kotak', () => {
    const pts = sparklinePoints([null, 10, null, 20, 15, null, 30], 260, 64);
    expect(pts).toHaveLength(4);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(260);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(64);
    }
    expect(pts[3]!.y).toBeLessThan(pts[0]!.y);
  });

  it('nilai datar tidak membagi nol', () => {
    const pts = sparklinePoints([12, 12], 100, 40);
    expect(pts.every((p) => Number.isFinite(p.y))).toBe(true);
    expect(sparklinePoints([null, null], 100, 40)).toEqual([]);
  });
});
