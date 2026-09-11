import type { Lesson } from '../types.ts';

const HOME = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];

/**
 * Unit 2 — Top Row. Urutan e i → r u → t y → w o → q p.
 *
 * Vokal `e` dan `i` sengaja didahulukan: begitu keduanya masuk, kata Inggris
 * nyata langsung bisa dipakai di setiap lesson berikutnya, dan latihan berhenti
 * terasa seperti mengetik sandi.
 *
 * `t y` diberi target akurasi sedikit lebih rendah karena jangkauannya menyilang
 * paling jauh; `q p` paling rendah karena kelingking di baris atas adalah
 * gerakan tersulit di unit ini.
 */
export const unit2Lessons: Lesson[] = [
  {
    id: 'u2-l1',
    unitId: 'u2',
    order: 1,
    kind: 'lesson',
    title: 'Keys E and I',
    newKeys: ['e', 'i'],
    reviewKeys: HOME,
    intro:
      'Jari tengah kiri naik ke E, jari tengah kanan naik ke I. Naik lalu turun lagi — jangan biarkan tangan ikut bergeser ke atas.',
    passCriteria: { minWpm: 20, minAccuracy: 95 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'ee ii ee ii ei ie eie iei de ki ed ik',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'de ki le se fe je he gi ed ik el es ef ij',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'words',
        generator: 'static',
        content:
          'die lie idea file life like lake deal lead head heal ideal legal eagle agile field',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'she said his idea; a legal deal; he heals a leg; all his files',
      },
    ],
  },
  {
    id: 'u2-l2',
    unitId: 'u2',
    order: 2,
    kind: 'lesson',
    title: 'Keys R and U',
    newKeys: ['r', 'u'],
    reviewKeys: [...HOME, 'e', 'i'],
    intro:
      'Telunjuk kiri naik serong ke R, telunjuk kanan naik serong ke U. Rasakan tonjolan F dan J saat jari kembali.',
    passCriteria: { minWpm: 21, minAccuracy: 95 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'rr uu rr uu ru ur rur uru fr ju rf uj',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'ur ru ar ra er re ir ri ug gu us su ud du',
      },
      { type: 'letters', generator: 'weighted-random', length: 150 },
      {
        type: 'words',
        generator: 'static',
        content:
          'rug rude rule ruler sure user grade guard girl jail read ride rise rush fresh drug guide raise',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'a fresh idea; his usual guide; she is sure; her hard rules',
      },
    ],
  },
  {
    id: 'u2-l3',
    unitId: 'u2',
    order: 3,
    kind: 'lesson',
    title: 'Keys T and Y',
    newKeys: ['t', 'y'],
    reviewKeys: [...HOME, 'e', 'i', 'r', 'u'],
    intro:
      'Dua-duanya tugas telunjuk, dan dua-duanya menjulur paling jauh: T di kanan atas F, Y di kiri atas J. Sering tertukar — pelan dulu.',
    passCriteria: { minWpm: 22, minAccuracy: 94 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'tt yy tt yy ty yt tyt yty ft jy tf yj',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'ty yt at ta et te it ti ut tu ay ya ry ty',
      },
      { type: 'letters', generator: 'weighted-random', length: 160 },
      {
        type: 'words',
        generator: 'static',
        content:
          'the that this they their there try style truth still least yield daily study utility',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'try that first; at least she tried; the truth is dull; day after day',
      },
    ],
  },
  {
    id: 'u2-l4',
    unitId: 'u2',
    order: 4,
    kind: 'lesson',
    title: 'Keys W and O',
    newKeys: ['w', 'o'],
    reviewKeys: [...HOME, 'e', 'i', 'r', 'u', 't', 'y'],
    intro:
      'Jari manis kiri naik ke W, jari manis kanan naik ke O. Kalau jari tengah ikut terangkat, perlambat sampai hanya satu jari yang bergerak.',
    passCriteria: { minWpm: 23, minAccuracy: 95 },
    drills: [
      {
        type: 'letters',
        generator: 'static',
        content: 'ww oo ww oo wo ow wow owo sw lo ws ol',
      },
      {
        type: 'syllables',
        generator: 'static',
        content: 'wo ow ou uo ol lo od do ot to wa aw we ew',
      },
      { type: 'letters', generator: 'weighted-random', length: 160 },
      {
        type: 'words',
        generator: 'static',
        content:
          'work world would those water flower toward yellow show slow follow shadow hollow',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'we work together; who wrote it; throw the door wide; two of those',
      },
    ],
  },
  {
    id: 'u2-l5',
    unitId: 'u2',
    order: 5,
    kind: 'lesson',
    title: 'Keys Q and P',
    newKeys: ['q', 'p'],
    reviewKeys: [...HOME, 'e', 'i', 'r', 'u', 't', 'y', 'w', 'o'],
    intro:
      'Kelingking kiri naik ke Q, kelingking kanan naik ke P. Ini gerakan tersulit di unit ini; targetnya diturunkan dan itu memang disengaja.',
    passCriteria: { minWpm: 20, minAccuracy: 93 },
    drills: [
      { type: 'letters', generator: 'static', content: 'qq pp qq pp qp pq aq ;p qa p; qu up' },
      {
        type: 'syllables',
        generator: 'static',
        content: 'qu up pa ap pe ep po op pi ip pl lp qui que',
      },
      { type: 'letters', generator: 'weighted-random', length: 170 },
      {
        type: 'words',
        generator: 'static',
        content:
          'people paper quite quiet square quilt liquid sharp plate grasp upper quart repair',
      },
      {
        type: 'phrases',
        generator: 'static',
        content: 'the quiet people wait; a sharp paper edge; equal parts; a quiet request',
      },
    ],
  },
  {
    id: 'u2-review',
    unitId: 'u2',
    order: 6,
    kind: 'review',
    title: 'Top Row Review',
    newKeys: [],
    reviewKeys: [...HOME, 'e', 'i', 'r', 'u', 't', 'y', 'w', 'o', 'q', 'p'],
    intro:
      'Dua baris sekaligus, tanpa melihat keyboard. Kalau matamu turun, tutup drill ini dan ulangi lesson tombol yang bikin ragu.',
    passCriteria: { minWpm: 25, minAccuracy: 95 },
    drills: [
      { type: 'letters', generator: 'weighted-random', length: 200 },
      {
        type: 'words',
        generator: 'static',
        content:
          'those quiet people write letters together while the older girls study his rough drafts',
      },
      {
        type: 'phrases',
        generator: 'static',
        content:
          'she quietly typed the letter; jugs of water rest apart; a squad of tired guards; is it true or false',
      },
    ],
  },
];
