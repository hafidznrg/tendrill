import type { Lesson } from '../types.ts';

const ALPHA = [
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
];

/**
 * Unit 4 — Words & Rhythm.
 *
 * Tidak ada tombol baru sama sekali. Yang dilatih adalah hal yang berbeda:
 * berhenti mengetik huruf per huruf dan mulai mengetik kata sebagai satu gerakan.
 * Karena beban kognitifnya turun (tidak ada tombol asing), target WPM di sini
 * naik paling tajam di seluruh kurikulum: 22 di akhir Unit 3 menjadi 30.
 *
 * Akurasi justru dinaikkan ke 96% — tertinggi di kurikulum. Kata umum sudah
 * dikenal mata; kalau masih banyak meleset di sini, masalahnya ada di Unit 1–3
 * dan review session akan menagihnya.
 */
export const unit4Lessons: Lesson[] = [
  {
    id: 'u4-l1',
    unitId: 'u4',
    order: 1,
    kind: 'lesson',
    title: 'Common Words I',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Tidak ada tombol baru mulai sekarang. Targetnya berubah: baca satu kata utuh, lalu ketik utuh — jangan mengeja per huruf.',
    passCriteria: { minWpm: 26, minAccuracy: 95 },
    drills: [
      {
        type: 'words',
        generator: 'static',
        content:
          'the of and to in is you that it he was for on are as with his they at be this have from',
      },
      {
        type: 'words',
        generator: 'static',
        content:
          'or one had by word but not what all were we when your can said there use an each which she',
      },
      {
        type: 'words',
        generator: 'static',
        content:
          'do how their if will up other about out many then them these so some her would make like him',
      },
      { type: 'words', generator: 'weighted-random', length: 220, pool: 'common-100' },
    ],
  },
  {
    id: 'u4-l2',
    unitId: 'u4',
    order: 2,
    kind: 'lesson',
    title: 'Common Words II',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Seratus kata berikutnya. Kata yang lebih panjang, jadi jangan kaget kalau WPM sempat turun sebelum naik lagi.',
    passCriteria: { minWpm: 27, minAccuracy: 95 },
    drills: [
      {
        type: 'words',
        generator: 'static',
        content:
          'time has look two more write go see number no way could people my than first water been call',
      },
      {
        type: 'words',
        generator: 'static',
        content:
          'who oil its now find long down day did get come made may part over new sound take only little',
      },
      {
        type: 'words',
        generator: 'static',
        content:
          'work know place year live me back give most very after thing our just name good sentence man',
      },
      { type: 'words', generator: 'weighted-random', length: 240, pool: 'common-200' },
    ],
  },
  {
    id: 'u4-l3',
    unitId: 'u4',
    order: 3,
    kind: 'lesson',
    title: 'Word Pairs and Rhythm',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Kata yang sering berpasangan sebaiknya diketik sebagai satu ketukan, bukan dua. Kejar ritme yang rata — bukan sprint lalu berhenti.',
    passCriteria: { minWpm: 28, minAccuracy: 96 },
    drills: [
      {
        type: 'phrases',
        generator: 'static',
        content: 'of the in the to the on the at the for the from the with the and the',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'it is he was they are we were there is that was this one those two',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'as soon as more than most of all one of the some of them out of the',
      },
      { type: 'phrases', generator: 'weighted-random', length: 240, pool: 'common-200' },
    ],
  },
  {
    id: 'u4-l4',
    unitId: 'u4',
    order: 4,
    kind: 'lesson',
    title: 'Short Sentences',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Kalimat pendek berkapital dan berakhir titik. Jaga tangan tetap di posisi awal saat menekan Shift — itu bagian yang biasanya buyar.',
    passCriteria: { minWpm: 29, minAccuracy: 96 },
    drills: [
      {
        type: 'sentences',
        generator: 'static',
        content: 'The train left before dawn. She packed a small bag. He forgot the map again.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content: 'Rain fell all night. The road was quiet. Nobody came to the door until noon.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'We start work at seven. The plan is simple. Keep the list short and finish it.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'My brother reads slowly. Her answer was clear. Their house sits behind the old school.',
      },
    ],
  },
  {
    id: 'u4-l5',
    unitId: 'u4',
    order: 5,
    kind: 'lesson',
    title: 'Paragraph Flow',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Paragraf panjang. Tujuannya bukan cepat, melainkan tidak berhenti: kecepatan yang rata selama satu menit mengalahkan sprint yang putus-putus.',
    passCriteria: { minWpm: 30, minAccuracy: 96 },
    drills: [
      {
        type: 'sentences',
        generator: 'static',
        content:
          'Learning to type well is mostly a matter of patience. The hands already know how to move, but they have never been asked to move in the same way twice. Every slow repetition builds a small piece of the habit, and the habit is what carries you later when you stop thinking about the keys at all.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'A good practice session is short and honest. Ten quiet minutes each day will take you further than two long hours once a week, because the hands forget quickly and remember slowly. Watch the screen, not the board, even when it feels wrong, and let the fingers find the way back on their own.',
      },
      { type: 'words', generator: 'weighted-random', length: 260, pool: 'common-200' },
    ],
  },
  {
    id: 'u4-review',
    unitId: 'u4',
    order: 6,
    kind: 'review',
    title: 'Rhythm Review',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Campuran kata dan kalimat, dibobot dari tombol yang paling lambat dan paling sering meleset di catatanmu sendiri.',
    passCriteria: { minWpm: 30, minAccuracy: 96 },
    drills: [
      { type: 'words', generator: 'weighted-random', length: 240, pool: 'common-200' },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'The office was empty by six, so she locked the front door, walked to the corner, and waited for a bus that never came on time.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'He kept a plain notebook in his coat, wrote down what he saw, and read it back on the train home. Most of it was useless. A few lines were not.',
      },
    ],
  },
];
