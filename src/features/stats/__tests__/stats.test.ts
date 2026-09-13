import { describe, expect, it } from 'vitest';
import {
  MIN_KEY_ATTEMPTS,
  accuracyRange,
  chartGeometry,
  computeKeyHeat,
  currentStreak,
  practiceDays,
  summarize,
  topKeys,
  wpmRange,
} from '../stats.ts';
import { defaultKeystats, type KeyStat, type KeystatsData } from '@/lib/storage/schema.ts';

/**
 * Perhitungan `/stats` (dok. 08 Fase 6 DoD). Semua asersi "tidak NaN" di sini
 * disertai kontrol negatif: kasus normal di sebelahnya harus menghasilkan angka
 * yang BERBEDA dari nol, supaya test tidak hijau hanya karena semuanya 0.
 */

const BOX = { width: 640, height: 160, padX: 36, padY: 14 };

function keystatsWith(keys: Record<string, KeyStat>): KeystatsData {
  return { ...defaultKeystats(), keys };
}

function stat(attempts: number, errors: number, meanMs: number): KeyStat {
  return { attempts, errors, totalMs: attempts * meanMs, slowCount: 0 };
}

describe('chartGeometry — 0, 1, dan 200 titik', () => {
  it('0 titik: tanpa garis, tanpa NaN di tick', () => {
    const geo = chartGeometry([], BOX, wpmRange([]));
    expect(geo.points).toEqual([]);
    expect(geo.path).toBe('');
    expect(geo.ticks.length).toBeGreaterThan(1);
    expect(geo.ticks.every(Number.isFinite)).toBe(true);
  });

  it('1 titik: satu titik di tengah horizontal, bukan x = NaN', () => {
    const geo = chartGeometry([42], BOX, wpmRange([42]));
    expect(geo.points).toHaveLength(1);
    expect(geo.points[0]!.x).toBe(320);
    expect(Number.isFinite(geo.points[0]!.y)).toBe(true);
    expect(geo.path).toBe('');
  });

  it('200 titik: garis utuh, semua titik di dalam kotak, ujung di tepi', () => {
    const values = Array.from({ length: 200 }, (_, i) => 20 + (i % 37));
    const geo = chartGeometry(values, BOX, wpmRange(values));
    expect(geo.points).toHaveLength(200);
    expect(geo.path.match(/[ML]/g)).toHaveLength(200);
    expect(geo.path).not.toMatch(/NaN|Infinity/);
    expect(geo.points[0]!.x).toBe(36);
    expect(geo.points[199]!.x).toBe(604);
    for (const p of geo.points) {
      expect(p.y).toBeGreaterThanOrEqual(14);
      expect(p.y).toBeLessThanOrEqual(146);
    }
  });

  it('nilai lebih tinggi digambar lebih ATAS (kontrol arah sumbu Y)', () => {
    const geo = chartGeometry([10, 50], BOX, { min: 0, max: 50 });
    expect(geo.points[1]!.y).toBeLessThan(geo.points[0]!.y);
    expect(geo.points[1]!.y).toBe(14);
  });

  it('nilai rusak (NaN) dari storage tidak bocor ke path', () => {
    const geo = chartGeometry([30, Number.NaN, 40], BOX, wpmRange([30, Number.NaN, 40]));
    expect(geo.path).not.toMatch(/NaN/);
  });
});

describe('rentang sumbu', () => {
  it('WPM minimal 0–10, dibulatkan ke kelipatan 10', () => {
    expect(wpmRange([])).toEqual({ min: 0, max: 10 });
    expect(wpmRange([43.2])).toEqual({ min: 0, max: 50 });
  });

  it('akurasi beratap 100, lantai tidak pernah di atas 90', () => {
    expect(accuracyRange([])).toEqual({ min: 90, max: 100 });
    expect(accuracyRange([100])).toEqual({ min: 90, max: 100 });
    expect(accuracyRange([96, 83])).toEqual({ min: 80, max: 100 });
  });
});

describe('computeKeyHeat', () => {
  it('a dan A digabung ke satu tombol fisik', () => {
    const heat = computeKeyHeat(keystatsWith({ a: stat(20, 2, 200), A: stat(10, 1, 300) }));
    const a = heat.get('a')!;
    expect(a.attempts).toBe(30);
    expect(a.errors).toBe(3);
    expect(a.meanMs).toBeCloseTo((20 * 200 + 10 * 300) / 30);
    expect(heat.has('A')).toBe(false);
  });

  it('spasi dipetakan ke tombol Space', () => {
    const heat = computeKeyHeat(keystatsWith({ ' ': stat(50, 0, 150) }));
    expect(heat.get('Space')?.attempts).toBe(50);
  });

  it(`tombol < ${MIN_KEY_ATTEMPTS} kemunculan netral, walau 100% salah`, () => {
    const heat = computeKeyHeat(keystatsWith({ q: stat(3, 3, 2000), e: stat(40, 0, 200) }));
    expect(heat.get('q')!.errorLevel).toBeNull();
    expect(heat.get('q')!.latencyLevel).toBeNull();
    // kontrol: tombol berdata cukup MEMANG dinilai
    expect(heat.get('e')!.errorLevel).toBe(0);
  });

  it('keystats kosong → peta kosong, tanpa NaN', () => {
    expect(computeKeyHeat(defaultKeystats()).size).toBe(0);
    const zero = computeKeyHeat(keystatsWith({ a: stat(0, 0, 0) }));
    expect(zero.get('a')!.errorRate).toBe(0);
    expect(zero.get('a')!.meanMs).toBe(0);
  });

  it('field rusak (string, negatif) dianggap 0, bukan NaN', () => {
    const broken = {
      attempts: 'x',
      errors: -4,
      totalMs: null,
      slowCount: 0,
    } as unknown as KeyStat;
    const heat = computeKeyHeat(keystatsWith({ a: broken }));
    expect(heat.get('a')!.errorRate).toBe(0);
    expect(heat.get('a')!.meanMs).toBe(0);
  });
});

/**
 * DoD: "heatmap latensi menyorot tombol yang memang terasa lambat, dan BERBEDA
 * dari heatmap error". Profil yang dok. 07 §9 sebut: pengguna 50 WPM yang
 * hampir tidak salah, tetapi kelingkingnya lambat, dan satu tombol telunjuk
 * yang cepat tapi sering meleset.
 */
describe('dua heatmap menjawab pertanyaan berbeda', () => {
  const profile = keystatsWith({
    // telunjuk & tengah: cepat (~220 ms)
    f: stat(300, 3, 210),
    j: stat(300, 3, 215),
    d: stat(250, 2, 220),
    k: stat(250, 2, 225),
    e: stat(400, 4, 215),
    i: stat(200, 2, 230),
    t: stat(200, 2, 210),
    // `r`: cepat tetapi sering meleset (tertukar dengan `t`)
    r: stat(200, 30, 205),
    // kelingking: nyaris tidak salah, tetapi lambat
    a: stat(300, 3, 390),
    p: stat(80, 0, 420),
    q: stat(40, 0, 460),
    ';': stat(60, 0, 380),
  });
  const heat = computeKeyHeat(profile);

  it('kelingking menyala di heatmap latensi, tidak di heatmap error', () => {
    for (const key of ['a', 'p', 'q', ';']) {
      expect(heat.get(key)!.latencyLevel, key).toBe(4);
      expect(heat.get(key)!.errorLevel, key).toBeLessThanOrEqual(1);
    }
  });

  it('`r` menyala di heatmap error, tidak di heatmap latensi', () => {
    expect(heat.get('r')!.errorLevel).toBe(4);
    expect(heat.get('r')!.latencyLevel).toBe(0);
  });

  it('tiga tombol terlemah kedua ukuran tidak beririsan', () => {
    const errors = topKeys(heat, 'errorRate').map((h) => h.keyId);
    const slow = topKeys(heat, 'meanMs').map((h) => h.keyId);
    expect(slow).toEqual(['q', 'p', 'a']);
    expect(errors[0]).toBe('r');
    expect(errors.filter((k) => slow.includes(k))).toEqual([]);
  });

  it('kontrol negatif: pengguna lambat SERAGAM tidak menyala di heatmap latensi', () => {
    // Skala absolut akan menyalakan seluruh keyboard pemula ini.
    const uniform = computeKeyHeat(
      keystatsWith({ f: stat(100, 5, 900), j: stat(100, 5, 910), a: stat(100, 5, 905) }),
    );
    for (const h of uniform.values()) expect(h.latencyLevel).toBe(0);
  });
});

describe('ringkasan dan hari berlatih', () => {
  const day = { sessions: 2, ms: 300000, avgWpm: 30, avgAccuracy: 95 };
  const now = new Date(2026, 8, 13, 9, 0).getTime();

  it('tanpa sesi: null, bukan NaN', () => {
    const s = summarize([], {});
    expect(s).toEqual({
      sessions: 0,
      recentWpm: null,
      recentAccuracy: null,
      bestWpm: null,
      totalMinutes: 0,
    });
  });

  it('30 hari berakhir hari ini, terlama dulu', () => {
    const days = practiceDays({ '2026-09-13': day, '2026-08-15': day, '2026-08-14': day }, now);
    expect(days).toHaveLength(30);
    expect(days[0]!.date).toBe('2026-08-15');
    expect(days[29]!.date).toBe('2026-09-13');
    expect(days.filter((d) => d.stat).length).toBe(2);
  });

  it('streak: hari ini belum berlatih tidak memutus streak', () => {
    expect(currentStreak({ '2026-09-12': day, '2026-09-11': day }, now)).toBe(2);
    expect(currentStreak({ '2026-09-13': day, '2026-09-12': day }, now)).toBe(2);
    expect(currentStreak({ '2026-09-10': day }, now)).toBe(0);
    expect(currentStreak({}, now)).toBe(0);
  });
});
