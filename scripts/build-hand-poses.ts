/**
 * Generator pose siluet tangan (ADR-037) — `finger-svg-tendrill/*.svg` → `src/data/hands/poses.ts`.
 *
 *   node --experimental-strip-types scripts/build-hand-poses.ts
 *
 * Gambar sumber digambar di atas SATU keyboard QWERTY yang tidak kita miliki
 * ukurannya. Keyboard itu direkonstruksi: ujung jari aktif tiap pose dicocokkan
 * ke pusat tombolnya dalam satuan tombol, lalu satu affine (skala, geser, miring)
 * di-fit dengan kuadrat terkecil. Semua titik dipindah lewat invers affine itu ke
 * "ruang keyboard" — 1 tombol = UNIT, 1 baris = UNIT, asal di pojok kiri atas
 * baris angka — dan dibulatkan ke integer. Runtime (`hands.ts`) cukup menambahkan
 * satu affine lagi dari ruang keyboard ke tombol yang diukur.
 *
 * Kenapa bukan mengunci ujung tiap pose ke tombolnya: estimasi ujung jari tidak
 * andal untuk jari yang menekuk ke baris bawah (X, Z, titik) — dicek visual,
 * gambarnya benar, estimatornya yang salah. Gambar dipercaya; estimasi hanya
 * dipakai untuk mem-fit keyboard, dengan pencilan dibuang. Pose yang ujungnya
 * tetap keluar dari tombolnya dikoreksi dengan memutar tangan (lihat `correct`).
 *
 * Gerbang: ujung jari setiap pose wajib jatuh DI DALAM tombol targetnya (juga
 * dijaga `hands.test.ts` di ruang tombol yang diukur), atau generator gagal.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'finger-svg-tendrill');
const OUT = join(ROOT, 'src', 'data', 'hands', 'poses.ts');
const UNIT = 32;

type Pt = [number, number];
type Cmd = { c: 'M' | 'L' | 'C' | 'Z'; p: Pt[] };

// ---------------------------------------------------------------- path → absolut
function parse(d: string): Cmd[] {
  const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Cmd[] = [];
  let i = 0;
  let cmd = '';
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0;
  let lcx = 0,
    lcy = 0; // kontrol terakhir (untuk S/T)
  let lastC = '';
  const num = () => parseFloat(toks[i++]!);
  // Flag busur boleh ditulis rapat ("a90 90 0 0115 20"): baca satu digit.
  const flag = () => {
    const t = toks[i]!;
    if (t.length > 1 && (t[0] === '0' || t[0] === '1')) {
      toks[i] = t.slice(1);
      return t[0] === '1';
    }
    i++;
    return t === '1';
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i]!)) cmd = toks[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0,
      oy = rel ? y : 0;
    switch (C) {
      case 'M':
        x = ox + num();
        y = oy + num();
        sx = x;
        sy = y;
        out.push({ c: 'M', p: [[x, y]] });
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        x = ox + num();
        y = oy + num();
        out.push({ c: 'L', p: [[x, y]] });
        break;
      case 'H':
        x = (rel ? x : 0) + num();
        out.push({ c: 'L', p: [[x, y]] });
        break;
      case 'V':
        y = (rel ? y : 0) + num();
        out.push({ c: 'L', p: [[x, y]] });
        break;
      case 'Z':
        x = sx;
        y = sy;
        out.push({ c: 'Z', p: [] });
        break;
      case 'C':
      case 'S': {
        let x1: number, y1: number;
        if (C === 'C') {
          x1 = ox + num();
          y1 = oy + num();
        } else if (lastC === 'C' || lastC === 'S') {
          x1 = 2 * x - lcx;
          y1 = 2 * y - lcy;
        } else {
          x1 = x;
          y1 = y;
        }
        const x2 = ox + num(),
          y2 = oy + num();
        const ex = ox + num(),
          ey = oy + num();
        out.push({
          c: 'C',
          p: [
            [x1, y1],
            [x2, y2],
            [ex, ey],
          ],
        });
        lcx = x2;
        lcy = y2;
        x = ex;
        y = ey;
        break;
      }
      case 'Q':
      case 'T': {
        let qx: number, qy: number;
        if (C === 'Q') {
          qx = ox + num();
          qy = oy + num();
        } else if (lastC === 'Q' || lastC === 'T') {
          qx = 2 * x - lcx;
          qy = 2 * y - lcy;
        } else {
          qx = x;
          qy = y;
        }
        const ex = ox + num(),
          ey = oy + num();
        out.push({
          c: 'C',
          p: [
            [x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y)],
            [ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey)],
            [ex, ey],
          ],
        });
        lcx = qx;
        lcy = qy;
        x = ex;
        y = ey;
        break;
      }
      case 'A': {
        const rx = num(),
          ry = num(),
          rot = num();
        const large = flag(),
          sweep = flag();
        const ex = ox + num(),
          ey = oy + num();
        for (const seg of arcToCubic(x, y, rx, ry, rot, large, sweep, ex, ey))
          out.push({ c: 'C', p: seg });
        x = ex;
        y = ey;
        break;
      }
      default:
        throw new Error(`perintah path tidak dikenal: ${cmd}`);
    }
    lastC = C;
  }
  return out;
}

function arcToCubic(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  rotDeg: number,
  large: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): Pt[][] {
  if (rx === 0 || ry === 0)
    return [
      [
        [x1, y1],
        [x2, y2],
        [x2, y2],
      ],
    ];
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi),
    sin = Math.sin(phi);
  const dx = (x1 - x2) / 2,
    dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy,
    y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry,
    cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2));
  const segs: Pt[][] = [];
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const P = (t: number): Pt => [
    cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  ];
  const D = (t: number): Pt => [
    -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  ];
  for (let s = 0; s < n; s++) {
    const a = t1 + s * step,
      b = a + step;
    const pa = P(a),
      pb = P(b),
      da = D(a),
      db = D(b);
    segs.push([
      [pa[0] + k * da[0], pa[1] + k * da[1]],
      [pb[0] - k * db[0], pb[1] - k * db[1]],
      pb,
    ]);
  }
  return segs;
}

/** Titik-titik sampel sepanjang path (kubik dipecah 8). Satu array per subpath. */
function polylines(cmds: Cmd[]): Pt[][] {
  const lines: Pt[][] = [];
  let cur: Pt[] = [];
  let start: Pt = [0, 0];
  for (const { c, p } of cmds) {
    if (c === 'M') {
      if (cur.length) lines.push(cur);
      cur = [p[0]!];
      start = p[0]!;
    } else if (c === 'L') cur.push(p[0]!);
    else if (c === 'Z') cur.push(start);
    else {
      const [x0, y0] = cur[cur.length - 1]!;
      const [[x1, y1], [x2, y2], [x3, y3]] = p as [Pt, Pt, Pt];
      for (let s = 1; s <= 8; s++) {
        const t = s / 8,
          u = 1 - t;
        cur.push([
          u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const mapCmds = (cmds: Cmd[], f: (p: Pt) => Pt): Cmd[] =>
  cmds.map(({ c, p }) => ({ c, p: p.map(f) }));

/**
 * Integer, RELATIF (m l c z) — tapi selisihnya dihitung dari titik absolut yang
 * SUDAH dibulatkan, jadi pembulatan tidak menumpuk sepanjang path. Relatif
 * memangkas ~40% gzip dibanding absolut. Format ini juga yang dibaca test.
 */
function encode(cmds: Cmd[]): string {
  let s = '';
  let last = '';
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0;
  const R = ([px, py]: Pt): Pt => [Math.round(px), Math.round(py)];
  for (const { c, p } of cmds) {
    if (c === 'Z') {
      s += 'z';
      last = 'z';
      x = sx;
      y = sy;
      continue;
    }
    const pts = p.map(R);
    const nums = pts.map(([px, py]) => `${px - x} ${py - y}`).join(' ');
    const lc = c.toLowerCase();
    s += lc === last && lc !== 'm' ? ` ${nums}` : `${lc}${nums}`;
    last = lc;
    [x, y] = pts[pts.length - 1]!;
    if (c === 'M') {
      sx = x;
      sy = y;
    }
  }
  return s.replace(/ -/g, '-');
}

// ---------------------------------------------------------------- grid QWERTY
// Sama dengan KEYBOARD_ROWS di fingerMap.ts (dijaga test: tombol yang tidak ada → gagal).
const ROWS: (string | [string, number])[][] = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', ['Backspace', 2]],
  [['Tab', 1.5], 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', ['\\', 1.5]],
  [['CapsLock', 1.75], 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", ['Enter', 2.25]],
  [['ShiftLeft', 2.25], 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', ['ShiftRight', 2.75]],
];
const cell = new Map<string, { cx: number; cy: number; w: number }>();
ROWS.forEach((row, r) => {
  let x = 0;
  for (const k of row) {
    const [id, w] = Array.isArray(k) ? k : [k, 1];
    cell.set(id, { cx: x + w / 2, cy: r + 0.5, w });
    x += w;
  }
});
cell.set('Space', { cx: 7.5, cy: 4.5, w: 10 });

const SOURCE_ID: Record<string, string> = {
  Backquote: '`',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  Digit0: '0',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};
const toId = (key: string) =>
  SOURCE_ID[key] ?? (key.startsWith('Key') ? key.slice(3).toLowerCase() : key);

// ---------------------------------------------------------------- baca sumber
interface Entry {
  key: string;
  filename: string;
  hand: 'left' | 'right';
  finger: string;
  derivedFrom?: string;
}
const manifest: Entry[] = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));

interface Raw {
  id: string;
  hand: 'left' | 'right';
  rest: boolean;
  skin: Cmd[];
  line: Cmd[];
  hl: Cmd[];
  derivedFrom?: string;
}
const raws: Raw[] = manifest.map((e) => {
  const svg = readFileSync(join(SRC, e.filename), 'utf8');
  const grab = (cls: string) =>
    [...svg.matchAll(new RegExp(`class="${cls}" d="([^"]*)"`, 'g'))].flatMap((m) =>
      parse(m[1]!),
    );
  return {
    id: e.finger === 'rest' ? `rest-${e.hand}` : toId(e.key),
    hand: e.hand,
    rest: e.finger === 'rest',
    skin: grab('th-skin'),
    line: grab('th-line'),
    hl: grab('th-hl'),
    ...(e.derivedFrom ? { derivedFrom: toId(e.derivedFrom) } : {}),
  };
});

// ---------------------------------------------------------------- fit keyboard sumber
/** Ujung = titik terjauh dari pangkal (tengah kedua ujung garis sorotan terpanjang). */
function tipOf(hl: Cmd[]): Pt {
  const lines = polylines(hl);
  const len = (l: Pt[]) =>
    l.reduce(
      (a, p, k) => (k ? a + Math.hypot(p[0] - l[k - 1]![0], p[1] - l[k - 1]![1]) : 0),
      0,
    );
  const l = lines.sort((a, b) => len(b) - len(a))[0]!;
  const bx = (l[0]![0] + l[l.length - 1]![0]) / 2,
    by = (l[0]![1] + l[l.length - 1]![1]) / 2;
  return l.reduce((best, p) =>
    Math.hypot(p[0] - bx, p[1] - by) > Math.hypot(best[0] - bx, best[1] - by) ? p : best,
  );
}

/** Kuadrat terkecil: px = a·u + c·v + e, py = b·u + d·v + f. */
function fitAffine(samples: { u: Pt; p: Pt }[]) {
  const solve = (axis: 0 | 1) => {
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const b = [0, 0, 0];
    for (const { u, p } of samples) {
      const v = [u[0], u[1], 1];
      for (let i = 0; i < 3; i++) {
        b[i]! += v[i]! * p[axis];
        for (let j = 0; j < 3; j++) M[i]![j]! += v[i]! * v[j]!;
      }
    }
    for (let i = 0; i < 3; i++)
      for (let k = i + 1; k < 3; k++) {
        const f = M[k]![i]! / M[i]![i]!;
        for (let j = i; j < 3; j++) M[k]![j]! -= f * M[i]![j]!;
        b[k]! -= f * b[i]!;
      }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = b[i]!;
      for (let j = i + 1; j < 3; j++) s -= M[i]![j]! * x[j]!;
      x[i] = s / M[i]![i]!;
    }
    return x as [number, number, number];
  };
  const [a, c, e] = solve(0);
  const [b, d, f] = solve(1);
  return { a, b, c, d, e, f };
}

let samples = raws
  .filter((r) => !r.rest && !r.derivedFrom && r.id !== 'Space' && r.hl.length)
  .map((r) => ({
    id: r.id,
    u: [cell.get(r.id)!.cx, cell.get(r.id)!.cy] as Pt,
    p: tipOf(r.hl),
  }));
let A = fitAffine(samples);
// Buang pencilan estimator (jari menekuk) lalu fit ulang.
for (let round = 0; round < 2; round++) {
  samples = samples.filter(({ u, p }) => {
    const ex = (p[0] - (A.a * u[0] + A.c * u[1] + A.e)) / A.a;
    const ey = (p[1] - (A.b * u[0] + A.d * u[1] + A.f)) / A.d;
    return Math.hypot(ex, ey) <= 0.4;
  });
  A = fitAffine(samples);
}
const det = A.a * A.d - A.b * A.c;
/** Sumber (px) → ruang keyboard (UNIT per tombol). */
const toKb = ([x, y]: Pt): Pt => {
  const dx = x - A.e,
    dy = y - A.f;
  return [((A.d * dx - A.c * dy) / det) * UNIT, ((-A.b * dx + A.a * dy) / det) * UNIT];
};

// ---------------------------------------------------------------- koreksi per pose
/**
 * Ujung jari yang bekerja = titik TERATAS garis sorotannya (jari selalu menunjuk
 * ke atas dari telapak, termasuk yang menekuk ke baris bawah — estimator "terjauh
 * dari pangkal" gagal justru di sana).
 */
const topOf = (hl: Cmd[]): Pt =>
  polylines(hl)
    .flat()
    .reduce((b, p) => (p[1] < b[1] ? p : b));

/**
 * Beberapa gambar sumber meleset dari keyboard-nya sendiri (x, z, c ke kiri;
 * `,` `.` `/` ke kanan), dan Backspace/CapsLock tidak ada sama sekali (dipinjam
 * dari pose berjari sama). Keduanya dikoreksi dengan cara yang sama: seluruh
 * tangan DIPUTAR di pergelangan sampai ujung jarinya berada di tengah tombol
 * target. Memutar, bukan menggeser — pergelangan tetap di tempatnya dan jari lain
 * ikut miring, persis tangan sungguhan yang menjangkau.
 */
function correct(pose: { skin: Cmd[]; line: Cmd[]; hl: Cmd[] }, id: string) {
  const c = cell.get(id)!;
  const tip = topOf(pose.hl);
  const dx = tip[0] / UNIT - c.cx;
  if (Math.abs(dx) <= Math.max(0.2, c.w / 2 - 0.35)) return { ...pose, rotated: 0 };
  const pts = polylines(pose.skin).flat();
  const py = Math.max(...pts.map((p) => p[1]));
  const wrist = pts.filter((p) => p[1] > py - UNIT * 0.5);
  const px = wrist.reduce((s, p) => s + p[0], 0) / wrist.length;
  const ang = Math.atan2(tip[1] - py, c.cx * UNIT - px) - Math.atan2(tip[1] - py, tip[0] - px);
  const cos = Math.cos(ang),
    sin = Math.sin(ang);
  const rot = ([x, y]: Pt): Pt => [
    px + (x - px) * cos - (y - py) * sin,
    py + (x - px) * sin + (y - py) * cos,
  ];
  return {
    skin: mapCmds(pose.skin, rot),
    line: mapCmds(pose.line, rot),
    hl: mapCmds(pose.hl, rot),
    rotated: (ang * 180) / Math.PI,
  };
}

// ---------------------------------------------------------------- gerbang: ujung jari di tombolnya
function tipInside(hl: Cmd[], id: string): boolean {
  const c = cell.get(id)!;
  const [x, y] = topOf(hl);
  return Math.abs(x / UNIT - c.cx) <= c.w / 2 && Math.abs(y / UNIT - c.cy) <= 0.5;
}

const poses: {
  id: string;
  hand: string;
  skin: string;
  line: string;
  hl: string;
  derivedFrom?: string;
}[] = [];
const failures: string[] = [];
const corrections: string[] = [];
for (const r of raws) {
  let skin = mapCmds(r.skin, toKb),
    line = mapCmds(r.line, toKb),
    hl = mapCmds(r.hl, toKb);
  if (!r.rest && r.id !== 'Space') {
    const fixed = correct({ skin, line, hl }, r.id);
    ({ skin, line, hl } = fixed);
    if (fixed.rotated) corrections.push(`${r.id} ${fixed.rotated.toFixed(1)}°`);
  }
  if (!r.rest && !tipInside(hl, r.id)) failures.push(r.id);
  poses.push({
    id: r.id,
    hand: r.hand,
    skin: encode(skin),
    line: encode(line),
    hl: encode(hl),
    ...(r.derivedFrom ? { derivedFrom: r.derivedFrom } : {}),
  });
}
if (failures.length) {
  console.error(`sorotan tidak menyentuh tombolnya: ${failures.join(', ')}`);
  process.exit(1);
}

poses.sort((a, b) => a.id.localeCompare(b.id));
const body = poses
  .map(
    (p) =>
      `  ${JSON.stringify(p.id)}: {\n    hand: '${p.hand}',${p.derivedFrom ? `\n    /** Tidak ada di sumber: pose ${JSON.stringify(p.derivedFrom)} diputar di pergelangan. */` : ''}\n    skin: '${p.skin}',\n    line: '${p.line}',\n    hl: '${p.hl}',\n  },`,
  )
  .join('\n');

mkdirSync(join(ROOT, 'src', 'data', 'hands'), { recursive: true });
writeFileSync(
  OUT,
  `// DIHASILKAN — jangan disunting tangan. Sumber: finger-svg-tendrill/, generator:
// scripts/build-hand-poses.ts (ADR-037). Koordinat dalam ruang keyboard:
// ${UNIT} satuan = 1 tombol = 1 baris, asal di pojok kiri atas baris angka.
// Dimuat lewat import() dinamis saja — chunk ini tidak boleh masuk bundel awal.

export const HAND_UNIT = ${UNIT};

export interface HandPose {
  hand: 'left' | 'right';
  /** Bentuk tangan (isi). */
  skin: string;
  /** Garis tepi & lipatan. */
  line: string;
  /** Tepi jari yang bekerja. */
  hl: string;
}

/** Kunci = id tombol di fingerMap.ts; 'rest-left' / 'rest-right' = posisi istirahat. */
export const HAND_POSES: Record<string, HandPose> = {
${body}
};
`,
);
console.log(`${poses.length} pose → ${OUT}`);
console.log(`diputar di pergelangan: ${corrections.join(', ') || '—'}`);
console.log(
  `keyboard sumber: ${A.a.toFixed(2)} px/tombol, ${A.d.toFixed(2)} px/baris, ${samples.length} sampel fit`,
);
