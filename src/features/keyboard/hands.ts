import {
  ALL_KEYS,
  FINGER_HOME,
  KEYBOARD_ROWS,
  handOf,
  type Finger,
  type KeyHint,
} from './fingerMap.ts';

/**
 * Geometri siluet tangan (ADR-036, ADR-037, dok. 07 §4) — pure, tanpa DOM.
 *
 * Bentuk tangan datang dari gambar pose per tombol (`src/data/hands/poses.ts`),
 * disimpan di *ruang keyboard*: `HAND_UNIT` satuan = 1 tombol = 1 baris, asal di
 * pojok kiri atas baris angka. Letaknya TIDAK dari gambar: modul ini mem-fit satu
 * affine dari ruang itu ke posisi tombol yang diukur, sekali per pengukuran.
 * Keyboard ini flex dan membungkus ulang saat zoom/resize (ADR-028), jadi yang
 * pas di satu lebar belum tentu pas di lebar lain — affine-nya yang menyesuaikan.
 *
 * Semua string (matriks, panah) dihitung DI SINI, supaya jalur keystroke hanya
 * mengambil string yang sudah ada — nol alokasi per ketukan.
 */

export interface KeyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Affine ruang keyboard → px: x' = a·x + c·y + e, y' = b·x + d·y + f (urutan `matrix()` SVG). */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface HandsGeometry {
  width: number;
  height: number;
  /** Affine ruang keyboard → px terukur. */
  affine: Affine;
  /** `affine` sebagai atribut `transform` siap tulis. */
  transform: string;
  /** keyId → path panah dari tombol istirahat jarinya. Tidak ada = tidak perlu panah. */
  reach: Map<string, string>;
}

/** Harus sama dengan `HAND_UNIT` di data pose (dijaga test). */
export const HAND_UNIT = 32;

export const REST_POSE = { left: 'rest-left', right: 'rest-right' } as const;

/** Pusat tiap tombol dalam satuan tombol, dari lebar di `KEYBOARD_ROWS`. */
export const KEY_UNITS: ReadonlyMap<string, { cx: number; cy: number; w: number }> = (() => {
  const units = new Map<string, { cx: number; cy: number; w: number }>();
  KEYBOARD_ROWS.forEach((row, r) => {
    let x = 0;
    for (const key of row) {
      const w = key.width ?? 1;
      units.set(key.id, { cx: x + w / 2, cy: r + 0.5, w });
      x += w;
    }
  });
  return units;
})();

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Kuadrat terkecil dari pusat tombol (satuan tombol) ke pusat tombol terukur.
 * Spasi tidak ikut: lebarnya flex dan pusatnya tidak mewakili grid.
 * null kalau tata letaknya degeneratif (mis. jsdom: semua ukuran nol).
 */
export function fitKeyboard(rects: ReadonlyMap<string, KeyRect>): Affine | null {
  // Matriks normal 3×3 (simetris) dan ruas kanan untuk x dan y.
  let suu = 0,
    suv = 0,
    su = 0,
    svv = 0,
    sv = 0,
    n = 0;
  let sux = 0,
    svx = 0,
    sx = 0,
    suy = 0,
    svy = 0,
    sy = 0;
  for (const [id, unit] of KEY_UNITS) {
    if (id === 'Space') continue;
    const rect = rects.get(id);
    if (!rect) continue;
    const u = unit.cx,
      v = unit.cy;
    const x = rect.x + rect.w / 2,
      y = rect.y + rect.h / 2;
    suu += u * u;
    suv += u * v;
    su += u;
    svv += v * v;
    sv += v;
    n++;
    sux += u * x;
    svx += v * x;
    sx += x;
    suy += u * y;
    svy += v * y;
    sy += y;
  }
  const M = [
    [suu, suv, su],
    [suv, svv, sv],
    [su, sv, n],
  ] as const;
  const det3 = (m: readonly (readonly number[])[]) =>
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const D = det3(M);
  if (!(Math.abs(D) > 1e-9)) return null;
  // Aturan Cramer: cukup untuk 3×3 dan tanpa cabang pivot.
  const solve = (b0: number, b1: number, b2: number): [number, number, number] => {
    const col = (i: number) =>
      M.map((row, k) => row.map((val, j) => (j === i ? [b0, b1, b2][k]! : val)));
    return [det3(col(0)) / D, det3(col(1)) / D, det3(col(2)) / D];
  };
  const [ax, cx, ex] = solve(sux, svx, sx);
  const [bx, dy, fy] = solve(suy, svy, sy);
  const s = 1 / HAND_UNIT;
  const affine = { a: ax * s, b: bx * s, c: cx * s, d: dy * s, e: ex, f: fy };
  if (!(Math.abs(affine.a * affine.d - affine.b * affine.c) > 1e-12)) return null;
  return affine;
}

export function buildHands(
  rects: ReadonlyMap<string, KeyRect>,
  width: number,
  height: number,
): HandsGeometry | null {
  const a = rects.get('a');
  if (!a) return null;
  // Tata letak degeneratif (jsdom) tetap mendapat siluet: skala satu tombol per px,
  // supaya jalur pelukis tetap bisa dites tanpa layout.
  const affine = fitKeyboard(rects) ?? {
    a: 1 / HAND_UNIT,
    b: 0,
    c: 0,
    d: 1 / HAND_UNIT,
    e: 0,
    f: 0,
  };
  const transform = `matrix(${[affine.a, affine.b, affine.c, affine.d, affine.e, affine.f]
    .map((v, i) => (i < 4 ? Math.round(v * 1e5) / 1e5 : r2(v)))
    .join(' ')})`;

  const u = a.w || 1;
  const reach = new Map<string, string>();
  for (const key of ALL_KEYS) {
    const path = reachPath(rects, key.id, key.finger, u);
    if (path) reach.set(key.id, path);
  }
  return { width, height, affine, transform, reach };
}

/**
 * Pose tangan `side` untuk petunjuk `hint`. Mengembalikan id pose (kunci
 * `HAND_POSES`) — string yang sudah ada, tanpa alokasi, karena dipanggil per ketukan.
 *
 * Tangan yang mengetik memakai pose tombolnya; tangan lain memakai pose Shift kalau
 * karakternya ber-Shift (Shift selalu di sisi berlawanan, dok. 07 §4), selain itu
 * beristirahat. Spasi dipegang jempol kanan — sumber tidak punya pose jempol kiri.
 */
export function poseIdFor(side: 'left' | 'right', hint: KeyHint | null): string {
  if (!hint) return REST_POSE[side];
  const hand = handOf(hint.finger);
  const typing = hand === 'thumb' ? 'right' : hand;
  if (typing === side) return hint.keyId;
  return hint.shiftKeyId ?? REST_POSE[side];
}

/**
 * Panah dari tombol istirahat `finger` ke `keyId`: kurva kuadrat yang sedikit
 * melengkung, berhenti sebelum pusat tombol supaya mata panah tidak menutup label.
 * null kalau jari memang sudah di sana, atau jempol (ia tidak pernah pindah).
 */
export function reachPath(
  rects: ReadonlyMap<string, KeyRect>,
  keyId: string,
  finger: Finger,
  u: number,
): string | null {
  if (finger === 'thumb') return null;
  const homeId = FINGER_HOME[finger];
  if (homeId === keyId) return null;
  const from = rects.get(homeId);
  const to = rects.get(keyId);
  if (!from || !to) return null;

  const x0 = from.x + from.w / 2;
  const y0 = from.y + from.h / 2;
  let x1 = to.x + to.w / 2;
  let y1 = to.y + to.h / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  // Mundur sepertiga tombol dari pusat tujuan.
  const back = Math.min(0.35 * u, dist / 3);
  x1 -= (dx / dist) * back;
  y1 -= (dy / dist) * back;
  // Titik kontrol tegak lurus, selalu melengkung ke atas-kiri relatif arah gerak.
  const cx = (x0 + x1) / 2 - (dy / dist) * dist * 0.2;
  const cy = (y0 + y1) / 2 + (dx / dist) * dist * 0.2;
  return `M${r1(x0)},${r1(y0)}Q${r1(cx)},${r1(cy)} ${r1(x1)},${r1(y1)}`;
}
