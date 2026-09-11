import { describe, expect, it } from 'vitest';
import { applyKey, computeResult, createSession } from '../index.ts';
import fixture from './fixtures/session-01.json' with { type: 'json' };

/**
 * Golden fixture (dok. 09 §2.2).
 *
 * Satu rekaman keystroke nyata beserta hasil yang diharapkan. Perlindungan
 * paling murah terhadap regresi diam-diam: setiap refactor yang menggeser angka
 * langsung ketahuan, termasuk pergeseran yang tidak dilanggar satu pun unit test.
 *
 * Kalau test ini merah, pertanyaannya BUKAN "bagaimana membuatnya hijau" —
 * melainkan "apakah arti metriknya memang sengaja diubah?". Kalau ya, ubah
 * fixture-nya dan catat alasannya di dok. 10.
 */
describe('golden fixture session-01', () => {
  it('menghasilkan SessionResult yang sama persis', () => {
    const s = createSession(fixture.target, 40);
    for (const e of fixture.stream) applyKey(s, e.key, e.atMs);

    const actual: Record<string, unknown> = { ...computeResult(s) };
    // completedAt memakai Date.now(), jadi ia memang tidak bisa di-fixture-kan.
    delete actual['completedAt'];

    expect(actual).toEqual(fixture.expected);
  });

  it('angka utamanya cocok dengan verifikasi tangan', () => {
    const s = createSession(fixture.target, 40);
    for (const e of fixture.stream) applyKey(s, e.key, e.atMs);
    const r = computeResult(s);

    // 19 karakter, 'i' dan 'c' tertukar → 17 benar.
    expect(r.totalKeystrokes).toBe(19);
    expect(r.correctKeystrokes).toBe(17);
    expect(r.accuracy).toBeCloseTo((17 / 19) * 100, 10);
    expect(r.netWPM).toBeCloseTo(17 / 5 / (r.durationMs / 60_000), 10);
  });
});
