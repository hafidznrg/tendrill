/**
 * Tipe kurikulum. Mengikat dok. 04 §6.
 *
 * Aturan: tipe di sini TIDAK BOLEH memuat teks UI selain `title`/`intro`
 * yang di v1 memang disimpan per-locale (dok. 04 §12). Saat locale kedua
 * masuk, `title`/`intro` berubah jadi key i18n dan struktur ini tidak ikut berubah.
 */

export type LessonKind = 'placement' | 'lesson' | 'review';

export type DrillType = 'letters' | 'syllables' | 'words' | 'phrases' | 'sentences';

/**
 * `static`          → pakai `content` apa adanya.
 * `weighted-random` → dibangkitkan generator berbobot (dok. 04 §8).
 *                     Untuk type 'letters'/'syllables' generator menyusun huruf
 *                     dari newKeys+reviewKeys lesson ini.
 *                     Untuk type 'words'/'phrases'/'sentences' generator menyampel
 *                     dari wordlist `pool`, memprioritaskan entri yang memuat
 *                     tombol lemah pengguna (dok. 04 §10 langkah 4).
 */
export type DrillGenerator = 'static' | 'weighted-random';

export interface Drill {
  type: DrillType;
  generator: DrillGenerator;
  /** Wajib jika generator === 'static'. */
  content?: string;
  /** Panjang target karakter. Wajib jika generator === 'weighted-random'. */
  length?: number;
  /** Id wordlist di src/data/wordlists/en/. Hanya untuk generator berbasis kata. */
  pool?: string;
}

export interface PassCriteria {
  minWpm: number;
  minAccuracy: number;
}

export interface Lesson {
  id: string;
  unitId: string;
  order: number;
  kind: LessonKind;
  title: string;
  /** Tombol yang diperkenalkan lesson ini. Maks 2 (kecuali Unit 6, lihat dok. 04 §1). */
  newKeys: string[];
  /** Tombol lama yang ikut dilatih. Wajib sudah diperkenalkan lesson sebelumnya. */
  reviewKeys: string[];
  drills: Drill[];
  passCriteria: PassCriteria;
  /** 1–2 kalimat panduan posisi jari (bahasa UI). */
  intro?: string;
}

export interface Unit {
  id: string;
  order: number;
  title: string;
  /** Ringkasan materi baru, untuk kartu unit di /learn. */
  summary: string;
  /** Kriteria lulus unit — dipakai review session dan ditampilkan di /learn. */
  passCriteria: PassCriteria;
}

export interface Curriculum {
  locale: string;
  version: number;
  units: Unit[];
  lessons: Lesson[];
}
