import type { Lesson } from '../types.ts';

const ROWS_1_2 = [
  'a',
  's',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  ';',
  'q',
  'w',
  'e',
  'r',
  't',
  'y',
  'u',
  'i',
  'o',
  'p',
];

/**
 * Unit 3 — Bottom Row & Shift.
 *
 * Pembagian tanggung jawab dengan Unit 5 (dok. 04 §4): DI SINI `,` `.` `/`
 * diajarkan sebagai POSISI FISIK — jari mana, arah mana. Pemakaiannya sebagai
 * tanda baca di dalam kalimat baru diajarkan di Unit 5. Karena itu drill di sini
 * memakainya sebagai karakter dan pemisah, bukan sebagai aturan tata tulis.
 *
 * Shift ditempatkan di akhir unit ini (bukan Unit 5) karena Unit 4 memakai
 * kalimat nyata, dan kalimat nyata berawalan huruf kapital.
 */
export const unit3Lessons: Lesson[] = [
  {
    id: 'u3-l1',
    unitId: 'u3',
    order: 1,
    kind: 'lesson',
    title: 'Keys V and M',
    newKeys: ['v', 'm'],
    reviewKeys: ROWS_1_2,
    intro:
      'Telunjuk kiri turun serong ke V, telunjuk kanan turun serong ke M. Baris bawah bikin pergelangan ingin ikut turun — tahan, hanya jarinya yang bergerak.',
    passCriteria: { minWpm: 20, minAccuracy: 94 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'vv mm vv mm vm mv fv jm vf mj vmv mvm',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'va av ve ev vi iv mo om ma am me em mu um',
      },
      { type: 'letters', generator: 'weighted-random', length: 170 },
      {
        type: 'words',
        generator: 'static',
        content:
          'move movie value valve small summer improve volume family travel mostly master',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'move it slowly; my summer values; improve the volume; every family meal',
      },
    ],
  },
  {
    id: 'u3-l2',
    unitId: 'u3',
    order: 2,
    kind: 'lesson',
    title: 'Keys C and Comma',
    newKeys: ['c', ','],
    reviewKeys: [...ROWS_1_2, 'v', 'm'],
    intro:
      'Jari tengah kiri turun ke C, jari tengah kanan turun ke koma. Di sini koma cuma soal posisi jari — aturan pemakaiannya menyusul di Unit 5.',
    passCriteria: { minWpm: 21, minAccuracy: 94 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'cc ,, cc ,, c, ,c dc k, cd ,k cvc m,m',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'ca ac ce ec ci ic co oc cu uc cl cr sc',
      },
      { type: 'letters', generator: 'weighted-random', length: 170 },
      {
        type: 'words',
        generator: 'static',
        content:
          'cost clear course social create voice circle school music special castle classic',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'milk, salt, water, sugar, rice, tea, oil, ice',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'of course, it is close; call me, please; slowly, carefully, correctly',
      },
    ],
  },
  {
    id: 'u3-l3',
    unitId: 'u3',
    order: 3,
    kind: 'lesson',
    title: 'Keys X and Period',
    newKeys: ['x', '.'],
    reviewKeys: [...ROWS_1_2, 'v', 'm', 'c', ','],
    intro:
      'Jari manis kiri turun ke X, jari manis kanan turun ke titik. X jarang muncul di teks nyata, jadi porsinya sengaja dipadatkan di sini.',
    passCriteria: { minWpm: 20, minAccuracy: 93 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'xx .. xx .. x. .x sx l. xs .l xcx .,.',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'ax xa ex xe ix xi ox xo ux xu axe ext',
      },
      { type: 'letters', generator: 'weighted-random', length: 170 },
      {
        type: 'words',
        generator: 'static',
        content:
          'exit extra text six fix mix flex excel exact taxi maximum export expert complex example',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'take the exit. copy the text. save the file. fix it later.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'the expert made a quick fix. he mixed six cups of extra sugar.',
      },
    ],
  },
  {
    id: 'u3-l4',
    unitId: 'u3',
    order: 4,
    kind: 'lesson',
    title: 'Keys Z and Slash',
    newKeys: ['z', '/'],
    reviewKeys: [...ROWS_1_2, 'v', 'm', 'c', ',', 'x', '.'],
    intro:
      'Kelingking kiri turun ke Z, kelingking kanan turun ke garis miring. Ini pasangan tersulit di seluruh papan — targetnya paling longgar di unit ini, dan itu disengaja.',
    passCriteria: { minWpm: 19, minAccuracy: 92 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'zz // zz // z/ /z az ;/ za /; zxz ./.',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'za az ze ez zi iz zo oz zu uz zz ize',
      },
      { type: 'letters', generator: 'weighted-random', length: 175 },
      {
        type: 'words',
        generator: 'static',
        content:
          'zero size zoom lazy quiz prize amaze gaze zest zip zigzag puzzle realize crazy',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'he/she am/pm km/h read/write copy/paste high/low type/size',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'the lazy quiz got a prize. size zero fits, size six does too.',
      },
    ],
  },
  {
    id: 'u3-l5',
    unitId: 'u3',
    order: 5,
    kind: 'lesson',
    title: 'Keys B and N',
    newKeys: ['b', 'n'],
    reviewKeys: [...ROWS_1_2, 'v', 'm', 'c', ',', 'x', '.', 'z', '/'],
    intro:
      'Dua huruf terakhir: telunjuk kiri menjulur ke B, telunjuk kanan menjulur ke N. Setelah lesson ini kamu memegang 26 huruf penuh.',
    passCriteria: { minWpm: 22, minAccuracy: 94 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'bb nn bb nn bn nb fb jn bf nj bnb nbn',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'ba ab be eb bi ib na an ne en ni in bo no',
      },
      { type: 'letters', generator: 'weighted-random', length: 180 },
      {
        type: 'words',
        generator: 'static',
        content:
          'number begin between brown nine never nobody nature basic beyond bring balance',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'the quick brown fox jumps over the lazy dog. pack my box with five dozen liquor jugs.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'a big number of birds began to sing before dawn, and nobody moved.',
      },
    ],
  },
  {
    id: 'u3-l6',
    unitId: 'u3',
    order: 6,
    kind: 'lesson',
    title: 'Shift and Capitals',
    newKeys: ['Shift'],
    reviewKeys: [...ROWS_1_2, 'v', 'm', 'c', ',', 'x', '.', 'z', '/', 'b', 'n'],
    intro:
      'Satu aturan, dan ini yang paling sering dilanggar: Shift ditekan dengan tangan YANG BERLAWANAN dari huruf yang diketik. Huruf tangan kiri pakai Shift kanan, dan sebaliknya.',
    passCriteria: { minWpm: 20, minAccuracy: 93 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'Ff Jj Dd Kk Ss Ll Aa Gg Hh Ff Jj Dd Kk',
      },
      {
        type: 'letters',
        generator: 'static',
        content: 'Qq Ww Ee Rr Tt Yy Uu Ii Oo Pp Zz Xx Cc Vv Bb Nn Mm',
      },
      {
        type: 'words',
        generator: 'static',
        content: 'Ana Budi Citra Dewi Eka Fajar Gita Hana Indra Joko Kirana Lukman',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'The Quick Brown Fox Jumps Over The Lazy Dog.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'She wrote to Mr. Adams in March. He now lives in New York, far from Jakarta.',
      },
    ],
  },
  {
    id: 'u3-review',
    unitId: 'u3',
    order: 7,
    kind: 'review',
    title: 'Full Alphabet Review',
    newKeys: [],
    reviewKeys: [...ROWS_1_2, 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'Shift'],
    intro:
      'Seluruh alfabet, tiga baris, plus kapital. Ini titik ukur sesungguhnya: kalau lolos di sini, tanganmu sudah tahu tempat setiap huruf.',
    passCriteria: { minWpm: 25, minAccuracy: 94 },
    drills: [
      { type: 'letters', generator: 'weighted-random', length: 200 },
      {
        type: 'sentences',
        generator: 'static',
        content: 'Jack quietly moved up the front seat, grabbed six boxes, and drove away.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'The five boxing wizards jump quickly. How vexingly quick daft zebras jump.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'Every morning Vera checks the small brown box, notes the numbers, and lets the dog out.',
      },
    ],
  },
];
