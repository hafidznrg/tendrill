import type { Unit } from './types.ts';

/**
 * Kriteria lulus unit mengikat dok. 04 §4.
 * Kriteria per-lesson (di file lessons/) memakai *ramp*: lebih longgar pada
 * lesson dengan tombol tersulit (kelingking, baris bawah, Shift), lalu naik
 * sampai persis menyentuh kriteria unit di review session.
 */
export const units: Unit[] = [
  {
    id: 'u0',
    order: 0,
    title: 'Placement Test',
    summary: 'Satu sesi 60 detik untuk menentukan titik mulai. Selalu bisa dilewati.',
    passCriteria: { minWpm: 0, minAccuracy: 0 },
  },
  {
    id: 'u1',
    order: 1,
    title: 'Home Row Foundation',
    summary: 'Baris awal: f j · d k · s l · a ; · g h',
    passCriteria: { minWpm: 20, minAccuracy: 95 },
  },
  {
    id: 'u2',
    order: 2,
    title: 'Top Row',
    summary: 'Baris atas: e i · r u · t y · w o · q p',
    passCriteria: { minWpm: 25, minAccuracy: 95 },
  },
  {
    id: 'u3',
    order: 3,
    title: 'Bottom Row & Shift',
    summary: 'Baris bawah: v m · c , · x . · z / · b n, lalu Shift dan huruf kapital',
    passCriteria: { minWpm: 25, minAccuracy: 94 },
  },
  {
    id: 'u4',
    order: 4,
    title: 'Words & Rhythm',
    summary: 'Tanpa tombol baru: kata umum, pasangan kata, kalimat, paragraf',
    passCriteria: { minWpm: 30, minAccuracy: 96 },
  },
  {
    id: 'u5',
    order: 5,
    title: 'Punctuation & Sentences',
    summary: 'Tanda baca dalam kalimat: . , \' " ? ! - :',
    passCriteria: { minWpm: 30, minAccuracy: 95 },
  },
  {
    id: 'u6',
    order: 6,
    title: 'Numbers & Symbols',
    summary: 'Baris angka 0–9 dan simbol @ # $ % & * ( )',
    passCriteria: { minWpm: 25, minAccuracy: 93 },
  },
];
