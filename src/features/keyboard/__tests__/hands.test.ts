import { describe, expect, it } from 'vitest';
import { ALL_KEYS, FINGER_HOME, KEYBOARD_ROWS, handOf, hintFor } from '../fingerMap.ts';
import {
  HAND_UNIT,
  KEY_UNITS,
  buildHands,
  fitKeyboard,
  poseIdFor,
  type Affine,
  type KeyRect,
} from '../hands.ts';
import { HAND_POSES, HAND_UNIT as DATA_UNIT } from '@/data/hands/poses.ts';

/**
 * Tata letak buatan: tiap satuan lebar = `pitch` px, baris `row` px, celah 4 px.
 * Dua ukuran berbeda dipakai supaya "pas" tidak kebetulan hanya di satu lebar.
 */
function fakeRects(pitch: number, row: number): Map<string, KeyRect> {
  const rects = new Map<string, KeyRect>();
  KEYBOARD_ROWS.forEach((keys, r) => {
    let x = 0;
    for (const key of keys) {
      const w = (key.width ?? 1) * pitch;
      rects.set(key.id, { x, y: r * row, w: w - 4, h: row - 4 });
      x += w;
    }
  });
  return rects;
}

/**
 * Titik PADA path relatif integer (m l c z — satu-satunya format generator).
 * Kubik disampel 8 langkah seperti di generator: titik kontrolnya sendiri bisa
 * jauh di luar kurva, dan membacanya sebagai "ujung jari" memberi merah palsu.
 */
function points(d: string): [number, number][] {
  const toks = d.match(/[mlcz]|-?\d+/g) ?? [];
  const pts: [number, number][] = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[mlcz]/.test(toks[i]!)) cmd = toks[i++]!;
    if (cmd === 'z') {
      x = sx;
      y = sy;
      continue;
    }
    if (cmd === 'c') {
      const x1 = x + num(),
        y1 = y + num(),
        x2 = x + num(),
        y2 = y + num();
      const x3 = x + num(),
        y3 = y + num();
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        const u = 1 - t;
        pts.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      x = x3;
      y = y3;
      continue;
    }
    x += num();
    y += num();
    pts.push([x, y]);
    if (cmd === 'm') {
      sx = x;
      sy = y;
      cmd = 'l';
    }
  }
  return pts;
}

const apply = (m: Affine, [x, y]: [number, number]) =>
  [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f] as const;

/** Ujung jari aktif = titik teratas garis sorotan (definisi yang sama dengan generator). */
const tipOf = (hl: string) => points(hl).reduce((b, p) => (p[1] < b[1] ? p : b));

describe('data pose siluet (ADR-037)', () => {
  it('ruang keyboard data dan geometri memakai satuan yang sama', () => {
    expect(DATA_UNIT).toBe(HAND_UNIT);
  });

  it('setiap tombol keyboard punya pose, di tangan yang benar', () => {
    for (const key of ALL_KEYS) {
      const pose = HAND_POSES[key.id];
      expect(pose, key.id).toBeDefined();
      const hand = handOf(key.finger);
      expect(pose!.hand, key.id).toBe(hand === 'thumb' ? 'right' : hand);
      expect(pose!.hl.length, key.id).toBeGreaterThan(0);
    }
    expect(HAND_POSES['rest-left']?.hand).toBe('left');
    expect(HAND_POSES['rest-right']?.hand).toBe('right');
  });

  it('pose istirahat tidak punya jari aktif', () => {
    expect(HAND_POSES['rest-left']!.hl).toBe('');
    expect(HAND_POSES['rest-right']!.hl).toBe('');
  });
});

describe('letak siluet mengikuti tombol yang diukur (ADR-037)', () => {
  for (const [pitch, row] of [
    [40, 40],
    [56, 44],
  ] as const) {
    describe(`tombol ${pitch}×${row} px`, () => {
      const rects = fakeRects(pitch, row);
      const affine = fitKeyboard(rects)!;

      it('affine memetakan pusat tiap tombol tepat ke tombol terukurnya', () => {
        for (const [id, unit] of KEY_UNITS) {
          if (id === 'Space') continue;
          const r = rects.get(id)!;
          const [x, y] = apply(affine, [unit.cx * HAND_UNIT, unit.cy * HAND_UNIT]);
          expect(x).toBeCloseTo(r.x + r.w / 2, 0);
          expect(y).toBeCloseTo(r.y + r.h / 2, 0);
        }
      });

      it('ujung jari aktif SETIAP pose jatuh di dalam tombolnya', () => {
        const miss: string[] = [];
        for (const [id, pose] of Object.entries(HAND_POSES)) {
          if (id.startsWith('rest-')) continue;
          const [x, y] = apply(affine, tipOf(pose.hl));
          const r = rects.get(id)!;
          // Celah antartombol (4 px) dihitung milik tombol: itu tetap bukan tetangganya.
          const inside =
            x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2;
          if (!inside) miss.push(`${id} (${x.toFixed(0)},${y.toFixed(0)})`);
        }
        expect(miss).toEqual([]);
      });

      it('telunjuk kanan di j dan telunjuk kiri di f — bukan h/g (kegagalan uji pemula)', () => {
        for (const [id, wrong] of [
          ['j', 'h'],
          ['f', 'g'],
        ] as const) {
          const [x] = apply(affine, tipOf(HAND_POSES[id]!.hl));
          const r = rects.get(id)!;
          const w = rects.get(wrong)!;
          expect(Math.abs(x - (r.x + r.w / 2))).toBeLessThan(Math.abs(x - (w.x + w.w / 2)));
        }
      });
    });
  }

  it('kontrol negatif: affine yang meleset SATU tombol membuat gerbang ujung jari merah', () => {
    const rects = fakeRects(40, 40);
    const good = fitKeyboard(rects)!;
    const shifted = { ...good, e: good.e + 40 };
    let inside = 0;
    for (const [id, pose] of Object.entries(HAND_POSES)) {
      if (id.startsWith('rest-') || id === 'Space') continue;
      const [x, y] = apply(shifted, tipOf(pose.hl));
      const r = rects.get(id)!;
      if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) inside++;
    }
    // Tombol lebar (Shift, Enter, Backspace) masih bisa menampung geseran satu tombol.
    expect(inside).toBeLessThanOrEqual(4);
  });

  it('kontrol negatif: tanpa affine (koordinat mentah), ujung jari tidak di tombolnya', () => {
    const rects = fakeRects(40, 40);
    const identity: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const [x, y] = apply(identity, tipOf(HAND_POSES['k']!.hl));
    const r = rects.get('k')!;
    expect(x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h).toBe(false);
  });

  it('tata letak degeneratif (jsdom, semua nol) tetap menghasilkan geometri', () => {
    const zero = new Map(
      [...fakeRects(40, 40)].map(([id]) => [id, { x: 0, y: 0, w: 0, h: 0 }]),
    );
    expect(fitKeyboard(zero)).toBeNull();
    expect(buildHands(zero, 0, 0)?.transform).toMatch(/^matrix\(/);
  });
});

describe('pose per petunjuk', () => {
  const pose = (char: string | null) => {
    const hint = char === null ? null : hintFor(char);
    return [poseIdFor('left', hint), poseIdFor('right', hint)];
  };

  it('tangan yang mengetik memakai pose tombolnya, yang lain beristirahat', () => {
    expect(pose('e')).toEqual(['e', 'rest-right']);
    expect(pose('j')).toEqual(['rest-left', 'j']);
  });

  it('Shift: tangan sisi berlawanan memakai pose Shift-nya', () => {
    expect(pose('J')).toEqual(['ShiftLeft', 'j']);
    expect(pose('A')).toEqual(['a', 'ShiftRight']);
  });

  it('spasi = jempol kanan; null = keduanya istirahat', () => {
    expect(pose(' ')).toEqual(['rest-left', 'Space']);
    expect(pose(null)).toEqual(['rest-left', 'rest-right']);
  });
});

describe('panah jangkauan', () => {
  const rects = fakeRects(40, 40);
  const geo = buildHands(rects, 600, 280)!;

  it('setiap jari punya tombol istirahat yang ada di layout', () => {
    for (const id of Object.values(FINGER_HOME)) {
      expect(ALL_KEYS.some((k) => k.id === id)).toBe(true);
    }
  });

  it('panah ada untuk tombol jangkauan, tidak untuk tombol istirahat atau spasi', () => {
    expect(geo.reach.has('e')).toBe(true);
    expect(geo.reach.has('Backspace')).toBe(true);
    expect(geo.reach.has('ShiftLeft')).toBe(true);
    expect(geo.reach.has('f')).toBe(false);
    expect(geo.reach.has('j')).toBe(false);
    expect(geo.reach.has('Space')).toBe(false);
  });

  it('panah berangkat dari pusat tombol istirahat jari yang benar', () => {
    const d = geo.reach.get('y')!; // telunjuk kanan → dari j
    const j = rects.get('j')!;
    expect(d.startsWith(`M${j.x + j.w / 2},${j.y + j.h / 2}`)).toBe(true);
  });
});
