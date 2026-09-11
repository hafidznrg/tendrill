/**
 * Gerbang anggaran bundel (dok. 06 §6, dok. 08 Fase 0 DoD).
 *
 * "Batas yang tidak ditegakkan otomatis akan dilanggar dalam dua minggu."
 * Jalankan setelah `vite build`: node --experimental-strip-types scripts/check-bundle-budget.ts
 *
 * Definisi **bundel awal**: seluruh .js dan .css yang dirujuk langsung oleh
 * index.html plus modul yang di-preload olehnya — yaitu apa yang benar-benar
 * diunduh browser sebelum keystroke pertama mungkin terjadi.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const INITIAL_BUDGET_KB = 90; // dok. 06 §6
const TOTAL_BUDGET_KB = 250; // dok. 06 §6

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function gzipKb(file: string): number {
  return gzipSync(readFileSync(file), { level: 9 }).byteLength / 1024;
}

let html: string;
try {
  html = readFileSync(join(DIST, 'index.html'), 'utf8');
} catch {
  console.error('dist/index.html tidak ada — jalankan `npm run build` dulu.');
  process.exit(1);
}

const referenced = new Set(
  [...html.matchAll(/(?:src|href)="\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]!),
);

const assets = walk(DIST).filter((f) => /\.(js|css)$/.test(f));

let initial = 0;
let total = 0;
const rows: Array<[string, number, boolean]> = [];

for (const file of assets) {
  const rel = relative(DIST, file).split(sep).join('/');
  const kb = gzipKb(file);
  const isInitial = referenced.has(rel);
  total += kb;
  if (isInitial) initial += kb;
  rows.push([rel, kb, isInitial]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [rel, kb, isInitial] of rows) {
  console.log(`  ${isInitial ? '*' : ' '} ${kb.toFixed(1).padStart(7)} KB  ${rel}`);
}
console.log('  (* = bundel awal)\n');

const problems: string[] = [];
if (initial > INITIAL_BUDGET_KB) {
  problems.push(`bundel awal ${initial.toFixed(1)} KB > ${INITIAL_BUDGET_KB} KB gzip`);
}
if (total > TOTAL_BUDGET_KB) {
  problems.push(`total ${total.toFixed(1)} KB > ${TOTAL_BUDGET_KB} KB gzip`);
}

console.log(`bundel awal : ${initial.toFixed(1)} / ${INITIAL_BUDGET_KB} KB gzip`);
console.log(`total       : ${total.toFixed(1)} / ${TOTAL_BUDGET_KB} KB gzip`);

if (problems.length > 0) {
  console.error(`\nAnggaran bundel terlampaui (dok. 06 §6):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nAnggaran bundel aman.');
