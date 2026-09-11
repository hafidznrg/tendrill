import type { Lesson } from '../types.ts';

/**
 * Unit 1 — Home Row Foundation.
 *
 * Urutan f j → d k → s l → a ; → g h mengikuti kekuatan jari (dok. 04 §1 poin 3):
 * telunjuk dulu, kelingking terakhir.
 *
 * Konsekuensi yang perlu diketahui: KATA NYATA BARU MUNGKIN SETELAH `a` MASUK
 * di l4 — tanpa vokal, `f j d k s l` tidak membentuk satu pun kata Inggris.
 * Karena itu l1–l3 murni letters/syllables, dan itu memang benar secara
 * pedagogis: yang dilatih di tiga lesson pertama adalah anchoring jari, bukan makna.
 * (Contoh di dok. 04 §6 keliru memakai kata ber-`a` pada u1-l3; sudah diperbaiki.)
 */
export const unit1Lessons: Lesson[] = [
  {
    id: 'u1-l1',
    unitId: 'u1',
    order: 1,
    kind: 'lesson',
    title: 'Keys F and J',
    newKeys: ['f', 'j'],
    reviewKeys: [],
    intro:
      'Telunjuk kiri di F, telunjuk kanan di J — dua tombol itu punya tonjolan kecil, raba dulu tanpa melihat. Jempol menggantung di spasi dan tidak pernah pindah.',
    passCriteria: { minWpm: 18, minAccuracy: 95 },
    drills: [
      { type: 'letters', generator: 'static', content: 'ff jj ff jj ff jj fj fj jf jf fj jf' },
      {
        type: 'letters',
        generator: 'static',
        content: 'fff jjj fff jjj ffj jjf fjf jfj ffj jjf',
      },
      { type: 'letters', generator: 'weighted-random', length: 120 },
      {
        type: 'letters',
        generator: 'static',
        content: 'fjfj jfjf ffjj jjff fjjf jffj fj jf ff jj',
      },
    ],
  },
  {
    id: 'u1-l2',
    unitId: 'u1',
    order: 2,
    kind: 'lesson',
    title: 'Keys D and K',
    newKeys: ['d', 'k'],
    reviewKeys: ['f', 'j'],
    intro:
      'Jari tengah kiri ke D, jari tengah kanan ke K. Telunjuk tetap menempel di F dan J — jangan ikut terangkat.',
    passCriteria: { minWpm: 18, minAccuracy: 95 },
    drills: [
      { type: 'letters', generator: 'static', content: 'dd kk dd kk dd kk dk dk kd kd dk kd' },
      {
        type: 'letters',
        generator: 'static',
        content: 'fd jk fd jk df kj df kj fdf jkj dfd kjk',
      },
      { type: 'letters', generator: 'weighted-random', length: 130 },
      {
        type: 'letters',
        generator: 'static',
        content: 'fdk jkd dfj kdj kfd jdk fjdk kdjf dkfj jfkd',
      },
    ],
  },
  {
    id: 'u1-l3',
    unitId: 'u1',
    order: 3,
    kind: 'lesson',
    title: 'Keys S and L',
    newKeys: ['s', 'l'],
    reviewKeys: ['f', 'j', 'd', 'k'],
    intro:
      'Jari manis kiri ke S, jari manis kanan ke L. Jari manis paling malas ikut bergerak sendiri — perhatikan agar D dan K tidak ikut tertekan.',
    passCriteria: { minWpm: 18, minAccuracy: 95 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'ss ll ss ll ss ll sl sl ls ls sls lsl',
      },
      { type: 'letters', generator: 'static', content: 'sd lk sd lk ds kl ds kl sf lj fs jl' },
      { type: 'letters', generator: 'weighted-random', length: 140 },
      {
        type: 'syllables',
        generator: 'static',
        content: 'sdf lkj fds jkl sdfl lkjs dslf klfj sfd ljk',
      },
    ],
  },
  {
    id: 'u1-l4',
    unitId: 'u1',
    order: 4,
    kind: 'lesson',
    title: 'Keys A and Semicolon',
    newKeys: ['a', ';'],
    reviewKeys: ['f', 'j', 'd', 'k', 's', 'l'],
    intro:
      'Kelingking kiri ke A, kelingking kanan ke titik koma. Ini jari paling lemah dan paling lambat terbentuk — targetnya sengaja diturunkan, jangan panik kalau terasa kaku.',
    passCriteria: { minWpm: 16, minAccuracy: 94 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'aa ;; aa ;; aa ;; a; a; ;a ;a a;a ;a;',
      },
      {
        type: 'letters',
        generator: 'static',
        content: 'asdf jkl; asdf jkl; fdsa ;lkj fdsa ;lkj',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'words',
        generator: 'static',
        content: 'as ask add all fall lad lads dad sad fad flask salad',
      },
    ],
  },
  {
    id: 'u1-l5',
    unitId: 'u1',
    order: 5,
    kind: 'lesson',
    title: 'Keys G and H',
    newKeys: ['g', 'h'],
    reviewKeys: ['f', 'j', 'd', 'k', 's', 'l', 'a', ';'],
    intro:
      'Telunjuk kiri menjulur ke kanan untuk G, telunjuk kanan menjulur ke kiri untuk H. Setelah ditekan, jari langsung kembali ke F dan J.',
    passCriteria: { minWpm: 18, minAccuracy: 95 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'gg hh gg hh gh hg ghg hgh fg jh gf hj',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'gag hag lag sag gas gal has had gad hal',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'words',
        generator: 'static',
        content: 'glad glass flag flags flash gash hall half lash shall slash salad',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'a glad lad; half a flask; all glass flags; dad has salad',
      },
    ],
  },
  {
    id: 'u1-review',
    unitId: 'u1',
    order: 6,
    kind: 'review',
    title: 'Home Row Review',
    newKeys: [],
    reviewKeys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
    intro:
      'Seluruh baris awal sekaligus. Bobot huruf diambil dari kesalahan dan kelambatanmu sendiri, jadi tiap orang dapat drill yang berbeda.',
    passCriteria: { minWpm: 20, minAccuracy: 95 },
    drills: [
      { type: 'letters', generator: 'weighted-random', length: 180 },
      {
        type: 'words',
        generator: 'static',
        content:
          'ask all add fall lads salad flask glass flash half hall shall glad flag gash lash',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'a sad lad; all glass flags; half a salad; dad asks; a glad flash',
      },
    ],
  },
];
