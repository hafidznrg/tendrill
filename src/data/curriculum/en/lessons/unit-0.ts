import type { Lesson } from '../types.ts';

/**
 * Unit 0 — Placement Test (dok. 04 §3).
 *
 * Satu-satunya lesson yang BOLEH memakai tombol yang belum diajarkan: tujuannya
 * justru menyentuh seluruh keyboard supaya diagnosisnya menyeluruh. Validator
 * kurikulum mengecualikan `kind: 'placement'` dari aturan kumulatif.
 *
 * Teksnya sengaja prosa biasa, bukan pangram beruntun: yang diukur adalah ritme
 * mengetik nyata, bukan kemampuan mengeja kalimat aneh. Komposisinya diatur agar
 * setiap baris keyboard, kapital, koma, titik, dan satu angka muncul minimal sekali.
 */
export const unit0Lessons: Lesson[] = [
  {
    id: 'u0-placement',
    unitId: 'u0',
    order: 0,
    kind: 'placement',
    title: 'Placement Test',
    newKeys: [],
    reviewKeys: [],
    intro:
      'Enam puluh detik untuk melihat posisi awalmu. Ketik senyaman biasanya — jangan buru-buru, jangan sengaja pelan. Boleh dilewati kalau kamu ingin mulai dari nol.',
    passCriteria: { minWpm: 0, minAccuracy: 0 },
    drills: [
      {
        type: 'sentences',
        generator: 'static',
        content:
          'The quick brown fox jumps over the lazy dog. Every morning she opens the window and lets the cold air fill the room. Work is quiet before seven, so most of the writing happens then. Jack forgot his keys, his badge, and the printed map, but the drive was short enough. A good habit is built one plain day at a time, not in a single burst of effort.',
      },
    ],
  },
];
