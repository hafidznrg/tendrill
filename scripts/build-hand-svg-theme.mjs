// Mengubah SVG siluet asli (finger-svg/*.svg, tidak di-commit) ke tema Tendrill → finger-svg-tendrill/.
// Jalankan: node scripts/build-hand-svg-theme.mjs   (lalu: build-hand-poses.ts)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'finger-svg');
const OUT = join(SRC, '..', 'finger-svg-tendrill');
mkdirSync(OUT, { recursive: true });

// Jari Tendrill (fingerMap.ts): f1–f4 kiri kelingking→telunjuk, f5–f8 kanan telunjuk→kelingking.
const FINGER_ID = {
  left: { pinky: 'f1', ring: 'f2', middle: 'f3', index: 'f4', thumb: 'thumb' },
  right: { index: 'f5', middle: 'f6', ring: 'f7', pinky: 'f8', thumb: 'thumb' },
};
const FINGER_NAME = {
  pinky: 'kelingking', ring: 'manis', middle: 'tengah', index: 'telunjuk', thumb: 'jempol',
};

// Tombol yang tidak ada di keyboard Tendrill (tanpa baris Alt) dibuang.
const DROP = new Set(['AltLeft', 'AltRight', 'ShiftAltLeft', 'ShiftAltRight']);
// Tombol Tendrill yang tidak punya file: pakai sorotan jari yang sama.
const ALIAS = [
  { key: 'Backspace', from: 'Minus', filename: 'backspace.svg' },
  { key: 'CapsLock', from: 'KeyA', filename: 'caps_lock.svg' },
];

// Warna: token tendrill (src/assets/brand/tokens.css) dengan fallback supaya
// file tetap benar saat dibuka berdiri sendiri, terang maupun gelap.
const STYLE = `<style>
.th{--th-skin:var(--fg-dim,#6E776E);--th-line:var(--fg,#161A17);--th-accent:var(--accent,#2F6B4A);--th-ground:var(--bg,#EFF2EE)}
@media (prefers-color-scheme:dark){.th{--th-skin:var(--fg-dim,#8E988B);--th-line:var(--fg,#E7ECE3);--th-accent:var(--accent,#77B98D);--th-ground:var(--bg,#11150F)}}
.th-skin{fill:var(--th-skin);fill-opacity:.22}
.th-line{fill:none;stroke:var(--th-line);stroke-opacity:.38;stroke-width:1.5px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.th-glow{fill:none;stroke:var(--th-accent);stroke-opacity:.22;stroke-width:12px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.th-hl{fill:none;stroke:var(--th-accent);stroke-width:4px;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
</style>`;

const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const byKey = new Map(manifest.map((e) => [e.key, e]));
const outManifest = [];

function paths(svg) {
  return [...svg.matchAll(/<path\b([^>]*?)\/>/g)].map((m) => ({
    d: /\sd="([^"]*)"/.exec(m[1])[1],
    style: /style="([^"]*)"/.exec(m[1])?.[1] ?? '',
    hasFillAttr: /\sfill="/.test(m[1]),
  }));
}

function convert(entry, key, filename) {
  const raw = readFileSync(join(SRC, entry.filename), 'utf8');
  const ps = paths(raw);
  const skin = ps.filter((p) => p.hasFillAttr);
  const hl = ps.filter((p) => p.style.includes('stroke:orange'));
  const line = ps.filter((p) => !p.hasFillAttr && !p.style.includes('stroke:orange'));
  const neutral = entry.finger.startsWith('neutral');
  const finger = neutral ? null : FINGER_ID[entry.hand][entry.finger];
  const handId = entry.hand === 'left' ? 'kiri' : 'kanan';
  const title = neutral
    ? `Tangan ${handId} posisi istirahat`
    : `${key}: ${FINGER_NAME[entry.finger]} ${handId}`;

  const hlD = hl.map((p) => p.d).join(' ');
  const body = [
    `<title>${title}</title>`,
    STYLE,
    `<g class="th-hand" data-hand="${entry.hand}">`,
    ...skin.map((p) => `<path class="th-skin" d="${p.d}"/>`),
    ...line.map((p) => `<path class="th-line" d="${p.d}"/>`),
    `</g>`,
    hl.length
      ? `<g class="th-active"${finger ? ` data-hand-finger="${finger}"` : ''}><path class="th-glow" d="${hlD}"/><path class="th-hl" d="${hlD}"/></g>`
      : '',
  ].join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="th" viewBox="0 0 716.3 380" role="img" data-key="${key}"${finger ? ` data-finger="${finger}"` : ''}>` +
    body +
    `</svg>\n`;
  writeFileSync(join(OUT, filename), svg);
  outManifest.push({
    key,
    filename,
    hand: entry.hand,
    finger: finger ?? 'rest',
    highlightSegments: hl.length,
    ...(key !== entry.key ? { derivedFrom: entry.key } : {}),
  });
}

for (const e of manifest) {
  if (DROP.has(e.key)) continue;
  convert(e, e.key, e.filename);
}
for (const a of ALIAS) convert(byKey.get(a.from), a.key, a.filename);

outManifest.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(outManifest, null, 2) + '\n');

console.log(`${outManifest.length} SVG → ${OUT}`);
