import type { Lesson } from '../types.ts';

const ALPHA_PUNCT = [
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
  'z',
  'x',
  'c',
  'v',
  'b',
  'n',
  'm',
  ',',
  '.',
  '/',
  'Shift',
  "'",
  '"',
  '?',
  '!',
  '-',
  ':',
];

/**
 * Unit 6 — Numbers & Symbols.
 *
 * Dua pengecualian yang disengaja terhadap aturan umum:
 *
 * 1. Lebih dari 2 tombol baru per lesson. Angka dipelajari berpasangan simetris
 *    (4 5 6 7 = dua telunjuk, 3 8 = dua jari tengah, dan seterusnya). Memecahnya
 *    jadi 2 tombol akan memisahkan pasangan tangan kiri/kanan yang justru
 *    memudahkan hafalan, dan menambah lima lesson tanpa manfaat.
 * 2. Target WPM paling rendah di seluruh kurikulum. Baris angka memang lambat
 *    bahkan untuk pengetik mahir; menargetkan 30 WPM di sini hanya membuat
 *    pengguna gagal berulang kali di akhir kurikulum.
 *
 * Kelulusan akhir (>= 40 WPM, >= 95%) diukur pada drill prosa di `u6-review`,
 * BUKAN pada drill angka/simbol — mencampur keduanya dalam satu ambang akan
 * menghukum kemampuan yang sudah terbentuk.
 */
export const unit6Lessons: Lesson[] = [
  {
    id: 'u6-l1',
    unitId: 'u6',
    order: 1,
    kind: 'lesson',
    title: 'Number Row: 4 5 6 7',
    newKeys: ['4', '5', '6', '7'],
    reviewKeys: ALPHA_PUNCT,
    intro:
      'Telunjuk kiri naik dua baris ke 4, menjulur ke 5. Telunjuk kanan ke 7, menjulur ke 6. Mata tetap di layar — raba F dan J untuk pulang.',
    passCriteria: { minWpm: 18, minAccuracy: 93 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'f4 f5 j7 j6 4f 5f 7j 6j 44 55 66 77 45 54 67 76',
      },
      {
        type: 'letters',
        generator: 'static',
        content: '444 555 666 777 4567 7654 456 567 674 745 47 56',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'phrases',
        generator: 'static',
        content: '45 rows, 67 seats, 56 files, 74 pages, 65 words, 47 lines',
      },
    ],
  },
  {
    id: 'u6-l2',
    unitId: 'u6',
    order: 2,
    kind: 'lesson',
    title: 'Number Row: 3 8 2 9',
    newKeys: ['3', '8', '2', '9'],
    reviewKeys: [...ALPHA_PUNCT, '4', '5', '6', '7'],
    intro:
      'Jari tengah naik ke 3 dan 8, jari manis ke 2 dan 9. Polanya sama dengan huruf: jari yang sama, dua baris ke atas.',
    passCriteria: { minWpm: 18, minAccuracy: 93 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'd3 k8 s2 l9 3d 8k 2s 9l 33 88 22 99 38 83 29 92',
      },
      {
        type: 'letters',
        generator: 'static',
        content: '234 789 345 678 2345 6789 987 432 23 89 32 98',
      },
      { type: 'letters', generator: 'weighted-random', length: 160 },
      {
        type: 'phrases',
        generator: 'static',
        content: '23 boxes, 89 names, 38 days, 92 steps, 47 trips, 65 cards',
      },
    ],
  },
  {
    id: 'u6-l3',
    unitId: 'u6',
    order: 3,
    kind: 'lesson',
    title: 'Number Row: 1 and 0',
    newKeys: ['1', '0'],
    reviewKeys: [...ALPHA_PUNCT, '2', '3', '4', '5', '6', '7', '8', '9'],
    intro:
      'Kelingking naik dua baris: kiri ke 1, kanan ke 0. Jangkauan terjauh di papan, jadi targetnya paling rendah — wajar kalau tangan sempat bergeser.',
    passCriteria: { minWpm: 16, minAccuracy: 92 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'a1 ;0 1a 0; 11 00 10 01 101 010 1010 0101',
      },
      {
        type: 'letters',
        generator: 'static',
        content: '1234567890 0987654321 100 101 110 1000 10 20 30 40 50',
      },
      { type: 'letters', generator: 'weighted-random', length: 160 },
      {
        type: 'phrases',
        generator: 'static',
        content: '2026, 1998, 365 days, 24 hours, 60 minutes, 100 percent, 10 of 12',
      },
    ],
  },
  {
    id: 'u6-l4',
    unitId: 'u6',
    order: 4,
    kind: 'lesson',
    title: 'Symbols: @ # $ %',
    newKeys: ['@', '#', '$', '%'],
    reviewKeys: [...ALPHA_PUNCT, '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    intro:
      'Semuanya Shift plus angka yang baru saja kamu pelajari: 2 3 4 5. Shift-nya tangan kanan, karena keempat simbol ini ada di tangan kiri.',
    passCriteria: { minWpm: 15, minAccuracy: 92 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: '@@ ## $$ %% @# #@ $% %$ s@ d# f$ g% @s #d $f %g',
      },
      {
        type: 'letters',
        generator: 'static',
        content: '@2 #3 $4 %5 2@ 3# 4$ 5% @#$% %$#@ #@ $%',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'phrases',
        generator: 'static',
        content: 'ana@mail.com, #typing, $25, 50% off, #1 pick, $100 total, 95% done',
      },
    ],
  },
  {
    id: 'u6-l5',
    unitId: 'u6',
    order: 5,
    kind: 'lesson',
    title: 'Symbols: & * ( )',
    newKeys: ['&', '*', '(', ')'],
    reviewKeys: [
      ...ALPHA_PUNCT,
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      '@',
      '#',
      '$',
      '%',
    ],
    intro:
      'Shift plus 7 8 9 0 — keempatnya di tangan kanan, jadi Shift-nya tangan kiri. Kurung buka dan tutup hampir selalu berpasangan; latih sebagai satu gerakan.',
    passCriteria: { minWpm: 14, minAccuracy: 91 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: '&& ** (( )) &* *& () )( j& k* l( ;) &j *k (l );',
      },
      {
        type: 'letters',
        generator: 'static',
        content: '&7 *8 (9 )0 7& 8* 9( 0) &*() ()*& (( )) ()',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'phrases',
        generator: 'static',
        content: '(a & b), 5 * 4, R&D, (see note), 3 * (2 * 6), Q&A, (draft 2)',
      },
    ],
  },
  {
    id: 'u6-review',
    unitId: 'u6',
    order: 6,
    kind: 'review',
    title: 'Final Mixed Test',
    newKeys: [],
    reviewKeys: [
      ...ALPHA_PUNCT,
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
      '@',
      '#',
      '$',
      '%',
      '&',
      '*',
      '(',
      ')',
    ],
    intro:
      'Dua bagian. Bagian angka dan simbol dinilai dengan target unit; dua drill prosa terakhir adalah tes kelulusan sesungguhnya: 40 WPM, 95%.',
    passCriteria: { minWpm: 25, minAccuracy: 93 },
    drills: [
      { type: 'letters', generator: 'weighted-random', length: 180 },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'Invoice #4021 was sent to budi@mail.com on March 8, 2026. The total came to $1,350 - about 15% over the estimate we gave in January.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'Nobody learns to type in a week. What actually happens is quieter than that: a few weeks of short, honest sessions, one row at a time, until the day you notice that you have not looked down in an hour.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'You are at the end of the course, which mostly means the course is done teaching you. The rest is ordinary use - letters, notes, code, whatever you write anyway - and the habit will keep improving on its own now, as long as you keep your eyes on the screen.',
      },
    ],
  },
];
