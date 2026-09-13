/**
 * Gerbang graf chunk (dok. 06 §6, CLAUDE.md §2).
 *
 * Aturan yang dijaga: **halaman sesi tidak boleh menarik peta kurikulum
 * lengkap.** `loadLesson.ts` sudah menepatinya di sumber — ia sengaja hanya
 * mengimpor `units.ts`, bukan `index.ts` — tetapi itu tidak cukup. Aturan ini
 * bisa batal tanpa satu baris impor pun berubah, cukup lewat `manualChunks`
 * yang menggabungkan `units.ts` dengan `index.ts` ke satu chunk. Persis itu
 * yang terjadi sejak Fase 3 dan tidak ada yang menangkapnya.
 *
 * Kenapa `npm run budget` tidak bisa menggantikan ini: ia mengukur **bundel
 * awal**. Chunk lazy yang menarik sepuluh kali lipat data yang dibutuhkan tidak
 * pernah membuatnya merah.
 *
 * Yang diperiksa: dari chunk tiap halaman sesi, telusuri impor **statis** saja
 * (`import(...)` dinamis memang tugasnya memuat satu unit saat diminta), lalu
 * pastikan tidak ada chunk terlarang yang bisa dicapai.
 *
 * Jalankan setelah `vite build`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = join(fileURLToPath(new URL('..', import.meta.url)), 'dist', 'assets');

/**
 * Chunk halaman sesi — titik awal penelusuran.
 *
 * `PracticePage` ikut sejak Fase 5: ia MEMANG memakai wordlist, tetapi lewat
 * `import()` dinamis (ADR-032). Mengubahnya menjadi impor statis akan menarik
 * seluruh pool ke chunk halamannya tanpa satu test pun merah — persis bentuk
 * kegagalan yang melahirkan gerbang ini. `AdaptivePage` (Fase 7) sama persis.
 */
const SESSION_ENTRIES = ['LessonPage', 'PlacementPage', 'PracticePage', 'AdaptivePage'];

/**
 * Chunk yang tidak boleh tercapai secara statis dari halaman sesi.
 * `curriculum-map` = `data/curriculum/en/index.ts`, yang mengimpor ketujuh unit.
 */
const FORBIDDEN = [/^curriculum-map-/, /^unit-\d-/, /^wordlists-/];

let files: string[];
try {
  files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'));
} catch {
  console.error('dist/assets tidak ada — jalankan `npm run build` dulu.');
  process.exit(1);
}

/**
 * Nama chunk tanpa hash, untuk pesan yang bisa dibaca manusia.
 *
 * Membuang segmen TERAKHIR saja. Regex serakah seperti `-[\w-]{8,}\.js$` ikut
 * memakan bagian nama ("curriculum-map" → "curriculum", "unit-3" → "unit") dan
 * pesan gerbangnya berhenti menyebut chunk mana yang bermasalah.
 */
function label(file: string): string {
  const parts = file.replace(/\.js$/, '').split('-');
  return parts.length > 1 ? parts.slice(0, -1).join('-') : parts[0]!;
}

/**
 * Impor STATIS sebuah chunk. `import"./x.js"` dan `from"./x.js"` ikut; bentuk
 * `import("./x.js")` sengaja TIDAK — itu justru mekanisme yang kita inginkan.
 */
function staticImports(file: string): string[] {
  const code = readFileSync(join(ASSETS, file), 'utf8');
  const found = new Set<string>();
  const re = /(?:^|[;}\s])(?:import|from)\s*"\.\/([A-Za-z0-9_.-]+\.js)"/g;
  for (const m of code.matchAll(re)) found.add(m[1]!);
  return [...found];
}

const graph = new Map<string, string[]>();
for (const file of files) graph.set(file, staticImports(file));

function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return seen;
}

const problems: string[] = [];

for (const entry of SESSION_ENTRIES) {
  const file = files.find((f) => basename(f).startsWith(`${entry}-`));
  if (!file) {
    problems.push(`chunk ${entry} tidak ditemukan — nama rute berubah?`);
    continue;
  }
  // Satu baris per chunk terlarang. Tanpa dedupe, satu `curriculum-map` yang
  // bocor melahirkan delapan baris dan pesan aslinya tenggelam.
  const hits = [...reachable(file)]
    .filter((hit) => FORBIDDEN.some((re) => re.test(hit)))
    .map(label)
    .sort();
  if (hits.length > 0) {
    problems.push(`${entry} menarik ${hits.join(', ')} lewat impor statis`);
  }
}

/**
 * Chunk yang wajib LAZY: tidak boleh tercapai statis dari entri aplikasi
 * (dok. 08 Fase 6 DoD: "chunk `stats` tidak masuk bundel awal").
 *
 * Kenapa diperiksa dari graf, bukan dari nama berkas: kalau `StatsPage`
 * diimpor statis di `router.tsx`, Rollup MELEBURKANNYA ke chunk entri — tidak
 * ada berkas `StatsPage-*.js` sama sekali, dan anggaran bundel awal hanya naik
 * beberapa KB tanpa merah. Jadi dua syarat: chunk-nya ada, dan entri tidak
 * mencapainya.
 */
const LAZY_ONLY = ['StatsPage'];

let entry: string | undefined;
try {
  const html = readFileSync(join(ASSETS, '..', 'index.html'), 'utf8');
  entry = /src="\/assets\/([^"]+\.js)"/.exec(html)?.[1];
} catch {
  /* ditangani di bawah */
}
if (!entry) {
  problems.push('chunk entri tidak ditemukan di dist/index.html');
} else {
  const fromEntry = reachable(entry);
  fromEntry.add(entry);
  for (const name of LAZY_ONLY) {
    const file = files.find((f) => basename(f).startsWith(`${name}-`));
    if (!file) {
      problems.push(`chunk ${name} tidak ada — ia ikut dilebur ke bundel awal (impor statis?)`);
    } else if (fromEntry.has(file)) {
      problems.push(`chunk ${name} tercapai statis dari entri — ia masuk bundel awal`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.length} pelanggaran graf chunk:\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nHalaman sesi hanya boleh memuat unit yang diminta, dan halaman LAZY_ONLY hanya lewat import() dinamis.',
  );
  process.exit(1);
}

console.log('Graf chunk aman — halaman sesi tidak menarik peta kurikulum.');
console.log(`  ${LAZY_ONLY.join(', ')}: lazy, di luar bundel awal`);
for (const entry of SESSION_ENTRIES) {
  const file = files.find((f) => basename(f).startsWith(`${entry}-`))!;
  console.log(`  ${entry}: ${reachable(file).size} chunk statis`);
}
