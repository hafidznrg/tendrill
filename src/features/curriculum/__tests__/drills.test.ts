import { describe, expect, it } from 'vitest';
import { curriculum, keysIntroducedThrough } from '@/data/curriculum/en/index.ts';
import type { Lesson } from '@/data/curriculum/en/types.ts';
import type { KeystatsData } from '@/lib/storage/schema.ts';
import { microDrillFor, resolveDrills, resolveDrillTexts } from '../drills.ts';

/**
 * Drill yang **dibangkitkan runtime** (dok. 09 §4).
 *
 * `scripts/validate-curriculum.ts` memeriksa isi statis dan isi pool, tetapi ia
 * tidak bisa memeriksa teks yang baru lahir saat pengguna membuka lesson. Di
 * situlah aturan paling keras kurikulum ini bisa bocor tanpa terlihat: **tidak
 * ada drill yang boleh memuat karakter yang tombolnya belum diperkenalkan.**
 * Test ini menutup celah itu untuk seluruh 37 lesson.
 */

const lessons = curriculum.lessons;

/** Karakter yang sah pada satu lesson — cermin aturan validator. */
function allowedChars(lesson: Lesson): Set<string> {
  const introduced = new Set(keysIntroducedThrough(lesson.id));
  const allowed = new Set<string>([' ']);
  for (const key of introduced) {
    if (key === 'Shift') continue;
    allowed.add(key);
  }
  if (introduced.has('Shift')) {
    for (const key of introduced) {
      if (key >= 'a' && key <= 'z') allowed.add(key.toUpperCase());
    }
  }
  return allowed;
}

/**
 * Sengaja bertipe bentuk STORAGE, bukan `DrillStats`: ini sekaligus memeriksa
 * bahwa `keystats` asli memang bisa langsung dipakai generator tanpa konversi.
 */
const STATS: KeystatsData['keys'] = {
  a: { attempts: 120, errors: 40, totalMs: 60_000, slowCount: 9 },
  ';': { attempts: 90, errors: 30, totalMs: 54_000, slowCount: 12 },
  e: { attempts: 400, errors: 12, totalMs: 60_000, slowCount: 2 },
};

describe('resolveDrills', () => {
  it.each(lessons.filter((l) => l.kind !== 'placement').map((l) => [l.id, l] as const))(
    '%s: seluruh drill hanya memakai tombol yang sudah diperkenalkan',
    async (_id, lesson) => {
      const allowed = allowedChars(lesson);
      // Dijalankan dengan DAN tanpa statistik: bobot mengubah pilihan karakter,
      // jadi satu jalan saja tidak membuktikan apa pun.
      for (const stats of [{}, STATS]) {
        const texts = await resolveDrillTexts(lesson, stats);
        expect(texts.length).toBeGreaterThanOrEqual(3);
        for (const text of texts) {
          for (const char of text) {
            expect(
              allowed.has(char),
              `${lesson.id} memakai "${char}" yang belum diajarkan`,
            ).toBe(true);
          }
        }
      }
    },
  );

  it('placement memang boleh menyentuh seluruh keyboard', async () => {
    const placement = lessons.find((l) => l.kind === 'placement')!;
    const texts = await resolveDrillTexts(placement);
    expect(texts).toHaveLength(1);
    expect(texts[0]!.length).toBeGreaterThan(200);
  });

  it('review session jalan dengan keystats kosong — bobot seragam (R-16)', async () => {
    const review = lessons.find((l) => l.id === 'u1-review')!;
    const texts = await resolveDrillTexts(review, {});
    expect(texts.length).toBeGreaterThanOrEqual(3);
    for (const text of texts) expect(text.length).toBeGreaterThan(0);
  });

  it('review session yang personal berbeda dari yang seragam', async () => {
    const review = lessons.find((l) => l.id === 'u1-review')!;
    // Drill dinamis pertama: tanpa statistik vs dengan "a" dan ";" yang buruk.
    const plain = (await resolveDrillTexts(review, {}, seeded(4)))[0]!;
    const personal = (await resolveDrillTexts(review, STATS, seeded(4)))[0]!;
    expect(personal).not.toBe(plain);
    const share = (text: string) => [...text].filter((c) => c === 'a' || c === ';').length;
    expect(share(personal)).toBeGreaterThan(share(plain));
  });

  it('drill kosong tidak pernah ikut — ia akan selesai sendiri tanpa keystroke', async () => {
    const lesson: Lesson = {
      id: 'x-1',
      unitId: 'u1',
      order: 1,
      kind: 'lesson',
      title: 'x',
      newKeys: ['f'],
      reviewKeys: [],
      passCriteria: { minWpm: 10, minAccuracy: 90 },
      drills: [
        { type: 'letters', generator: 'static', content: '   ' },
        { type: 'letters', generator: 'static', content: 'fff jjj' },
      ],
    };
    expect(await resolveDrillTexts(lesson)).toEqual(['fff jjj']);
  });

  it('pool yang tidak dikenal jatuh ke drill huruf, bukan crash', async () => {
    const lesson: Lesson = {
      id: 'x-2',
      unitId: 'u4',
      order: 1,
      kind: 'lesson',
      title: 'x',
      newKeys: [],
      reviewKeys: ['f', 'j', 'd', 'k'],
      passCriteria: { minWpm: 10, minAccuracy: 90 },
      drills: [
        { type: 'words', generator: 'weighted-random', length: 60, pool: 'tidak-ada' },
      ],
    };
    const texts = await resolveDrillTexts(lesson);
    expect(texts[0]).toHaveLength(60);
  });

  /**
   * Penanda tes kelulusan (ADR-030) harus tetap menempel pada TEKSNYA setelah
   * drill kosong dibuang. Dulu ini dua daftar terpisah, dan dua daftar yang bisa
   * bergeser sendiri-sendiri adalah bentuk bug yang sudah dua kali memakan
   * proyek ini.
   */
  it('penanda graduation ikut bergeser saat drill kosong dibuang', async () => {
    const lesson: Lesson = {
      id: 'x-3',
      unitId: 'u1',
      order: 1,
      kind: 'review',
      title: 'x',
      newKeys: [],
      reviewKeys: ['f', 'j'],
      passCriteria: { minWpm: 10, minAccuracy: 90 },
      drills: [
        { type: 'letters', generator: 'static', content: '   ' },
        { type: 'letters', generator: 'static', content: 'fff' },
        { type: 'letters', generator: 'static', graduation: true, content: 'jjj' },
      ],
    };
    expect(await resolveDrills(lesson)).toEqual([
      { text: 'fff', graduation: false },
      { text: 'jjj', graduation: true },
    ]);
  });

  it('u6-review: tepat dua drill graduation, dan sisanya tetap dinilai', async () => {
    const review = lessons.find((l) => l.id === 'u6-review')!;
    const resolved = await resolveDrills(review, {});
    expect(resolved.filter((d) => d.graduation)).toHaveLength(2);
    expect(resolved.filter((d) => !d.graduation).length).toBeGreaterThan(0);
    // Drill prosa yang penuh angka & simbol justru BUKAN tes kelulusan — persis
    // yang dok. 04 §4a minta dikeluarkan.
    const symbols = resolved.find((d) => d.text.includes('#4021'));
    expect(symbols?.graduation).toBe(false);
  });

  it('lesson biasa tidak punya satu pun drill graduation', async () => {
    for (const id of ['u1-l1', 'u3-review', 'u5-review', 'u6-l5']) {
      const lesson = lessons.find((l) => l.id === id)!;
      const resolved = await resolveDrills(lesson, {});
      expect(resolved.some((d) => d.graduation), id).toBe(false);
    }
  });
});

describe('microDrillFor (dok. 04 §9 percobaan 3)', () => {
  const lesson = lessons.find((l) => l.id === 'u1-l4')!;

  it('memusatkan latihan pada tombol yang gagal, tetap dengan konteks', () => {
    const text = microDrillFor(lesson, ['a', ';'], {}, seeded(2));
    expect(text.length).toBeGreaterThan(50);
    const focus = [...text].filter((c) => c === 'a' || c === ';').length;
    const other = [...text].filter((c) => c !== ' ' && c !== 'a' && c !== ';').length;
    expect(focus).toBeGreaterThan(other * 0.5); // dominan, bukan satu-satunya
    expect(other).toBeGreaterThan(0);
  });

  it('mengabaikan tombol yang bukan milik lesson ini', () => {
    const text = microDrillFor(lesson, ['z', 'q'], {}, seeded(2));
    expect(text).toBe('');
  });

  it('hanya memakai tombol lesson — tidak menyelundupkan huruf baru', () => {
    const allowed = allowedChars(lesson);
    for (const char of microDrillFor(lesson, ['a'], {}, seeded(9))) {
      expect(allowed.has(char)).toBe(true);
    }
  });
});

/** LCG kecil, sama seperti di test generator: kegagalan harus bisa diulang. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
