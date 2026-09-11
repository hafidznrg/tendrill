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
 * Unit 5 — Punctuation & Sentences.
 *
 * Unit 3 mengajarkan DI MANA `,` dan `.` berada. Unit 5 mengajarkan KAPAN
 * dipakai — jadi l1 sengaja tidak punya tombol baru: materinya murni pemakaian.
 *
 * Tombol baru di sini (`'` `"` `?` `!` `-` `:`) mayoritas urusan kelingking dan
 * sebagian butuh Shift, jadi target WPM per-lesson turun dari 30 ke 26 sebelum
 * naik lagi di review. Menurunkan target di lesson tersulit adalah cara menjaga
 * akurasi tetap 94–95%; menaikkan keduanya sekaligus hanya menghasilkan frustrasi.
 */
export const unit5Lessons: Lesson[] = [
  {
    id: 'u5-l1',
    unitId: 'u5',
    order: 1,
    kind: 'lesson',
    title: 'Period and Comma in Context',
    newKeys: [],
    reviewKeys: ALPHA,
    intro:
      'Tombolnya sudah kamu kenal sejak Unit 3. Yang baru: koma dan titik muncul di tengah aliran kalimat, dan jari harus kembali ke posisi awal tanpa jeda.',
    passCriteria: { minWpm: 28, minAccuracy: 95 },
    drills: [
      {
        type: 'phrases',
        generator: 'static',
        content:
          'Yes, of course. No, not today. Well, maybe later. Sure, go ahead. Fine, I agree.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'We packed bread, cheese, apples, and water for the trip. She checked the list twice, then closed the bag.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'After the meeting, which ran long, the team split into two groups. One went upstairs, the other stayed behind to clean up.',
      },
      { type: 'sentences', generator: 'weighted-random', length: 240, pool: 'sentences-basic' },
    ],
  },
  {
    id: 'u5-l2',
    unitId: 'u5',
    order: 2,
    kind: 'lesson',
    title: 'Apostrophe and Quotes',
    newKeys: ["'", '"'],
    reviewKeys: ALPHA,
    intro:
      'Kelingking kanan ke kanan dari titik koma. Petik satu tanpa Shift, petik dua dengan Shift kiri — jangan pernah Shift kanan untuk tombol ini.',
    passCriteria: { minWpm: 26, minAccuracy: 94 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: ';\' ;" ;\' ;" \'\' "" \';\' ";" a\' a" l\' l"',
      },
      {
        type: 'words',
        generator: 'static',
        content:
          "don't can't it's I'm you're we'll they've isn't hasn't shouldn't wouldn't didn't",
      },
      {
        type: 'phrases',
        generator: 'static',
        content: "Ana's book, the driver's seat, my brother's car, the school's gate",
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'She said, "Come in and sit down." He replied, "Not yet, I am still working." Then the room went quiet.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          "It isn't easy, but it's worth doing. They've waited long enough, and they won't wait again.",
      },
    ],
  },
  {
    id: 'u5-l3',
    unitId: 'u5',
    order: 3,
    kind: 'lesson',
    title: 'Question and Exclamation',
    newKeys: ['?', '!'],
    reviewKeys: [...ALPHA, "'", '"'],
    intro:
      'Tanda tanya adalah Shift kiri plus garis miring (kelingking kanan). Tanda seru adalah Shift kanan plus angka satu (kelingking kiri) — dua tangan, selalu.',
    passCriteria: { minWpm: 26, minAccuracy: 94 },
    drills: [
      { type: 'letters', generator: 'static', content: '?? !! ?? !! a? a! ;? ;! ?a !a ?! !?' },
      {
        type: 'phrases',
        generator: 'static',
        content: 'Who? What? When? Where? Why? How? Stop! Wait! Look out! Not now!',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'Where did you put the keys? I left them on the table! Are you sure? Look again, please.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'She asked, "Is this the right road?" He shouted back, "Turn left at the bridge!" Nobody heard him.',
      },
    ],
  },
  {
    id: 'u5-l4',
    unitId: 'u5',
    order: 4,
    kind: 'lesson',
    title: 'Hyphen and Colon',
    newKeys: ['-', ':'],
    reviewKeys: [...ALPHA, "'", '"', '?', '!'],
    intro:
      'Tanda hubung dijangkau kelingking kanan ke baris angka; titik dua adalah Shift kiri plus titik koma. Keduanya jauh, jadi jangan geser telapak tangan.',
    passCriteria: { minWpm: 26, minAccuracy: 94 },
    drills: [
      { type: 'letters', generator: 'static', content: '-- :: -- :: a- a: ;- ;: -a :a -: :-' },
      {
        type: 'words',
        generator: 'static',
        content: 'well-known state-of-the-art part-time follow-up long-term self-made off-hand',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'Note: bring three things. A pen, a map, and water. The rule is simple: leave early, arrive calm.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          'His answer was half-hearted: he agreed, but only after a long pause. The rest of the day went by in short, well-spaced bursts of work.',
      },
    ],
  },
  {
    id: 'u5-review',
    unitId: 'u5',
    order: 5,
    kind: 'review',
    title: 'Punctuation Review',
    newKeys: [],
    reviewKeys: [...ALPHA, "'", '"', '?', '!', '-', ':'],
    intro:
      'Seluruh tanda baca dalam teks yang wajar. Ini bentuk mengetik yang paling mirip pekerjaan sehari-hari.',
    passCriteria: { minWpm: 30, minAccuracy: 95 },
    drills: [
      { type: 'sentences', generator: 'weighted-random', length: 260, pool: 'sentences-punct' },
      {
        type: 'sentences',
        generator: 'static',
        content:
          '"Is the list ready?" she asked. "Almost," he said. "Two more names, and it\'s done." She nodded: there was still time - just barely.',
      },
      {
        type: 'sentences',
        generator: 'static',
        content:
          "The plan hasn't changed: we leave at first light, walk the long-abandoned road, and don't stop until the river. Bring water! Bring a map. Ask anyone who's done it before.",
      },
    ],
  },
];
