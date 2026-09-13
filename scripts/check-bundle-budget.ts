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

/**
 * Anggaran dipecah dua (ADR-018). Angka tunggal 96% berisi dependensi pihak
 * ketiga, jadi ia tidak pernah bisa menangkap kode kita sendiri membengkak.
 * `APP_BUDGET_KB` adalah satu-satunya angka yang benar-benar kita kendalikan —
 * itulah yang digigit tiap hari.
 */
const FRAMEWORK_BUDGET_KB = 85; // terkunci: menambah dependensi runtime wajib ADR
const APP_BUDGET_KB = 20; // kode kita di bundel awal
const INITIAL_BUDGET_KB = 90; // dok. 08 Fase 8 DoD (ADR-035); 105 dari ADR-018 pensiun
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

/** Chunk `vendor` = seluruh isi node_modules (lihat manualChunks di vite.config.ts). */
const isVendor = (rel: string) => /(^|\/)vendor-[^/]*\.js$/.test(rel);

let initial = 0;
let framework = 0;
let app = 0;
let total = 0;
const rows: Array<[string, number, boolean, string]> = [];

for (const file of assets) {
  const rel = relative(DIST, file).split(sep).join('/');
  const kb = gzipKb(file);
  const isInitial = referenced.has(rel);
  total += kb;
  if (isInitial) {
    initial += kb;
    if (isVendor(rel)) framework += kb;
    else if (rel.endsWith('.js')) app += kb;
  }
  const kind = isVendor(rel) ? 'framework' : rel.endsWith('.css') ? 'css' : 'app';
  rows.push([rel, kb, isInitial, kind]);
}

rows.sort((a, b) => b[1] - a[1]);
for (const [rel, kb, isInitial, kind] of rows) {
  console.log(
    `  ${kb.toFixed(1).padStart(7)} KB  ${(isInitial ? kind : '—').padEnd(9)}  ${rel}`,
  );
}
console.log('  (— = dimuat belakangan, di luar bundel awal)\n');

const problems: string[] = [];
if (framework > FRAMEWORK_BUDGET_KB) {
  problems.push(
    `framework ${framework.toFixed(1)} KB > ${FRAMEWORK_BUDGET_KB} KB gzip — ` +
      'menambah atau mengganti dependensi runtime wajib ADR (ADR-018)',
  );
}
if (app > APP_BUDGET_KB) {
  problems.push(
    `kode aplikasi ${app.toFixed(1)} KB > ${APP_BUDGET_KB} KB gzip — ` +
      'ini kode kita sendiri, bukan dependensi. Pindahkan ke chunk lazy atau rampingkan',
  );
}
if (initial > INITIAL_BUDGET_KB) {
  problems.push(`bundel awal ${initial.toFixed(1)} KB > ${INITIAL_BUDGET_KB} KB gzip`);
}
if (total > TOTAL_BUDGET_KB) {
  problems.push(`total ${total.toFixed(1)} KB > ${TOTAL_BUDGET_KB} KB gzip`);
}

function bar(used: number, budget: number): string {
  return '#'.repeat(Math.min(20, Math.round((used / budget) * 20))).padEnd(20, '.');
}

const line = (label: string, used: number, budget: number) =>
  `${label.padEnd(14)}${bar(used, budget)} ${used.toFixed(1).padStart(6)} / ${budget} KB gzip`;

console.log(line('framework', framework, FRAMEWORK_BUDGET_KB));
console.log(line('kode aplikasi', app, APP_BUDGET_KB));
console.log(line('bundel awal', initial, INITIAL_BUDGET_KB));
console.log(line('total', total, TOTAL_BUDGET_KB));

if (problems.length > 0) {
  console.error(`\nAnggaran bundel terlampaui (dok. 06 §6):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nAnggaran bundel aman.');
