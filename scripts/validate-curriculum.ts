/**
 * Validator kurikulum — wajib (dok. 04 §5, dok. 09).
 *
 * Jalankan: node --experimental-strip-types scripts/validate-curriculum.ts
 * Nanti dijalankan ulang sebagai test Vitest; sengaja ditulis tanpa dependensi
 * supaya bisa dipakai sebelum toolchain ada dan di CI sebagai gerbang build.
 *
 * Aturan terpenting adalah nomor 5: TIDAK ADA satu pun drill yang boleh memuat
 * karakter yang tombolnya belum diperkenalkan. Ini satu-satunya cara memastikan
 * "level"-nya benar — sekali sebuah lesson meminta huruf yang belum diajarkan,
 * seluruh janji kurikulum berjenjang batal.
 */
import { curriculum, lessons } from '../src/data/curriculum/en/index.ts';
import type { Lesson } from '../src/data/curriculum/en/types.ts';
import { pools } from '../src/data/wordlists/en/index.ts';

// --- peta layout QWERTY US -------------------------------------------------

const UNSHIFTED = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
const SHIFTED = '~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?';

/**
 * `newKeys` berisi KARAKTER yang diajarkan, bukan tombol fisik. Untuk karakter
 * ber-Shift (`"` `?` `!` `@`) yang diajarkan adalah chord-nya, dan itu tidak
 * membuat karakter dasarnya (`'` `/` `1` `2`) ikut terbuka. Satu-satunya
 * pseudo-key adalah 'Shift', yang membuka huruf kapital dari huruf kecil yang
 * sudah diperkenalkan.
 */
const BASE_OF = new Map<string, string>();
for (let i = 0; i < UNSHIFTED.length; i++) BASE_OF.set(SHIFTED[i]!, UNSHIFTED[i]!);

const TYPEABLE = new Set<string>([...UNSHIFTED.split(''), ...SHIFTED.split('')]);
const LAYOUT_KEYS = new Set<string>([...TYPEABLE, 'Shift']);
const isUpperLetter = (c: string) => c >= 'A' && c <= 'Z';

const KNOWN_POOLS = new Set(Object.keys(pools));

// --- pengumpulan kesalahan -------------------------------------------------

const errors: string[] = [];
const fail = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

// 1. id unik
const seenIds = new Set<string>();
for (const l of lessons) {
  if (seenIds.has(l.id)) fail(l.id, 'id duplikat');
  seenIds.add(l.id);
}

// 2. unit dikenal, urutan tidak bolong, review selalu terakhir di unitnya
const unitIds = new Set(curriculum.units.map((u) => u.id));
for (const unit of curriculum.units) {
  const inUnit = lessons.filter((l) => l.unitId === unit.id);
  if (inUnit.length === 0) fail(unit.id, 'unit tanpa lesson');
  const orders = inUnit.map((l) => l.order);
  const expected = unit.id === 'u0' ? [0] : inUnit.map((_, i) => i + 1);
  if (orders.join(',') !== expected.join(',')) {
    fail(
      unit.id,
      `order tidak berurutan: ${orders.join(',')} (harusnya ${expected.join(',')})`,
    );
  }
  const reviews = inUnit.filter((l) => l.kind === 'review');
  if (unit.id !== 'u0') {
    if (reviews.length !== 1)
      fail(unit.id, `harus punya tepat 1 review, ada ${reviews.length}`);
    else if (inUnit[inUnit.length - 1]!.kind !== 'review')
      fail(unit.id, 'review bukan lesson terakhir');
  }
}
for (const l of lessons) {
  if (!unitIds.has(l.unitId)) fail(l.id, `unitId tidak dikenal: ${l.unitId}`);
}

// 3–5. aturan kumulatif
const introduced = new Set<string>();

/** Alasan sebuah karakter belum boleh muncul, atau null kalau sudah boleh. */
function blockedReason(char: string): string | null {
  if (char === ' ') return null; // spasi selalu tersedia (jempol, dok. 04 §1)
  if (introduced.has(char)) return null;
  if (isUpperLetter(char)) {
    const lower = char.toLowerCase();
    if (!introduced.has('Shift')) return 'Shift belum diajarkan';
    if (!introduced.has(lower)) return `huruf "${lower}" belum diajarkan`;
    return null;
  }
  if (!TYPEABLE.has(char)) return 'di luar layout QWERTY US';
  return 'karakter belum diajarkan';
}

for (const lesson of lessons) {
  const where = lesson.id;

  // 3. newKeys harus ada di peta layout
  for (const key of lesson.newKeys) {
    if (!LAYOUT_KEYS.has(key)) fail(where, `newKey "${key}" tidak ada di layout QWERTY`);
    if (introduced.has(key))
      fail(where, `newKey "${key}" sudah diperkenalkan lesson sebelumnya`);
  }

  // 4. reviewKeys harus sudah diperkenalkan
  for (const key of lesson.reviewKeys) {
    if (!introduced.has(key)) fail(where, `reviewKey "${key}" belum pernah diperkenalkan`);
  }

  // maks 2 tombol baru, kecuali Unit 6 (pengecualian terdokumentasi)
  if (lesson.newKeys.length > 2 && lesson.unitId !== 'u6') {
    fail(where, `${lesson.newKeys.length} tombol baru — batasnya 2 di luar Unit 6`);
  }

  for (const key of lesson.newKeys) introduced.add(key);

  // 5. isi drill hanya boleh memakai tombol yang sudah diperkenalkan
  lesson.drills.forEach((drill, i) => {
    const at = `${where} drill#${i + 1}`;

    if (drill.generator === 'static') {
      if (!drill.content) return fail(at, 'generator static tanpa content');
      if (drill.length !== undefined) fail(at, 'generator static tidak boleh punya length');
    } else {
      if (drill.length === undefined) fail(at, 'generator weighted-random tanpa length');
      if (drill.content) fail(at, 'generator weighted-random tidak boleh punya content');
      const wordBased = ['words', 'phrases', 'sentences'].includes(drill.type);
      if (wordBased && !drill.pool)
        fail(at, `type "${drill.type}" + weighted-random butuh pool`);
      if (!wordBased && drill.pool) fail(at, `type "${drill.type}" tidak memakai pool`);
      if (drill.pool && !KNOWN_POOLS.has(drill.pool))
        fail(at, `pool tidak dikenal: ${drill.pool}`);
    }

    if (lesson.kind === 'placement') return; // dikecualikan, lihat unit-0.ts

    // isi pool ikut diperiksa terhadap tombol yang tersedia di lesson ini —
    // drill yang dibangkitkan runtime harus tunduk pada aturan yang sama.
    if (drill.pool && KNOWN_POOLS.has(drill.pool)) {
      const bad = new Map<string, string>();
      for (const entry of pools[drill.pool]!) {
        for (const char of entry) {
          const reason = blockedReason(char);
          if (reason) bad.set(`${entry} → "${char}"`, reason);
        }
      }
      for (const [what, reason] of bad) fail(at, `pool ${drill.pool}: ${what} — ${reason}`);
    }

    if (!drill.content) return;

    const offenders = new Map<string, string>();
    for (const char of drill.content) {
      const reason = blockedReason(char);
      if (reason) offenders.set(char, reason);
    }
    for (const [char, reason] of offenders) {
      fail(at, `memakai "${char}" — ${reason}`);
    }
  });
}

// 5b. tes kelulusan kursus (dok. 04 §4a, ADR-030)
//
// Ditandai eksplisit supaya "dua drill prosa terakhir" tidak lagi berarti
// "hitung mundur dua dari ujung" — aturan posisi yang berpindah diam-diam
// begitu ada yang menambah satu drill di akhir.
const GRADUATION_LESSON = 'u6-review';
for (const lesson of lessons) {
  const graduation = lesson.drills.filter((d) => d.graduation === true);
  if (lesson.id !== GRADUATION_LESSON) {
    if (graduation.length > 0)
      fail(lesson.id, `graduation hanya boleh di ${GRADUATION_LESSON}`);
    continue;
  }
  if (graduation.length !== 2)
    fail(lesson.id, `${graduation.length} drill graduation, harusnya tepat 2`);
  // Tanpa ini, kelulusan lesson-nya tidak punya satu pun drill untuk dinilai.
  if (graduation.length === lesson.drills.length)
    fail(lesson.id, 'seluruh drill bertanda graduation — kelulusan unit tidak bisa dinilai');
  for (const drill of graduation) {
    if (drill.generator !== 'static')
      fail(lesson.id, 'drill graduation harus static — tes kelulusan tidak boleh berubah isi');
  }
}

// 5c. tidak ada dua drill BERURUTAN dengan isi identik
//
// Bukan soal selera: layar sesi membuat sesi engine baru saat teks target
// berubah, jadi dua drill berturutan yang berteks sama pernah bisa membuat
// layarnya menggantung. Mekanismenya sudah diperbaiki (runId ikut naik tiap
// pindah drill, dijaga `drillAdvance.test.tsx`), dan aturan ini menjaga sisi
// datanya — drill kembar berurutan juga sekadar membuang waktu pengguna.
for (const lesson of lessons) {
  for (let i = 1; i < lesson.drills.length; i++) {
    const before = lesson.drills[i - 1]!;
    const current = lesson.drills[i]!;
    if (current.content !== undefined && current.content === before.content) {
      fail(lesson.id, `drill#${i} dan drill#${i + 1} isinya identik`);
    }
  }
}

// 6. kriteria lulus
for (const unit of curriculum.units) {
  if (unit.id === 'u0') continue;
  const inUnit = lessons.filter((l) => l.unitId === unit.id);
  const review = inUnit[inUnit.length - 1];
  if (!review) continue;
  if (
    review.passCriteria.minWpm !== unit.passCriteria.minWpm ||
    review.passCriteria.minAccuracy !== unit.passCriteria.minAccuracy
  ) {
    fail(review.id, 'kriteria review harus sama persis dengan kriteria unit');
  }
  for (const l of inUnit) {
    if (l.passCriteria.minWpm > unit.passCriteria.minWpm) {
      fail(l.id, 'minWpm lesson melebihi minWpm unit');
    }
    if (l.passCriteria.minAccuracy > unit.passCriteria.minAccuracy) {
      fail(l.id, 'minAccuracy lesson melebihi minAccuracy unit');
    }
    if (l.passCriteria.minAccuracy < 90)
      fail(l.id, 'akurasi di bawah 90% — akurasi tidak pernah dikompromikan');
  }
}

// 7. jumlah lesson mengikat dok. 04 §5
const counts = {
  placement: lessons.filter((l) => l.kind === 'placement').length,
  lesson: lessons.filter((l) => l.kind === 'lesson').length,
  review: lessons.filter((l) => l.kind === 'review').length,
};
if (counts.placement !== 1) fail('curriculum', `placement: ${counts.placement}, harusnya 1`);
if (counts.lesson !== 30) fail('curriculum', `lesson: ${counts.lesson}, harusnya 30`);
if (counts.review !== 6) fail('curriculum', `review: ${counts.review}, harusnya 6`);

// 8. tiap lesson punya intro dan minimal 3 drill
for (const l of lessons) {
  if (!l.intro) fail(l.id, 'tanpa intro');
  if (l.drills.length < 3 && l.kind !== 'placement')
    fail(l.id, `hanya ${l.drills.length} drill, minimal 3`);
}

// --- laporan ---------------------------------------------------------------

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
const missingLetters = alphabet.filter((c) => !introduced.has(c));
if (missingLetters.length > 0)
  fail('curriculum', `huruf tidak pernah diajarkan: ${missingLetters.join(' ')}`);

function drillChars(l: Lesson): number {
  return l.drills.reduce((n, d) => n + (d.content?.length ?? d.length ?? 0), 0);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} masalah kurikulum:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('Kurikulum valid.');
console.log(`  unit    : ${curriculum.units.length}`);
console.log(
  `  lesson  : ${counts.placement} placement + ${counts.lesson} lesson + ${counts.review} review`,
);
console.log(`  tombol  : ${introduced.size} diperkenalkan`);
console.log(`  karakter: ${lessons.reduce((n, l) => n + drillChars(l), 0)} total isi drill`);
