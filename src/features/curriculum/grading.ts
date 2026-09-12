import type { PassCriteria } from '@/data/curriculum/en/types.ts';
import { GRADUATION_CRITERIA } from '@/data/curriculum/en/units.ts';
import { combineResults, type SessionResult } from '@/lib/engine';
import { meetsCriteria } from './progress.ts';

/**
 * Penilaian satu percobaan lesson (dok. 04 §4a, ADR-030).
 *
 * **Pure.** Tanpa React, tanpa storage — supaya aturan yang paling mudah salah
 * di seluruh Fase 4 bisa diuji tanpa merender satu pun layar.
 *
 * Bentuk yang mengikat: satu percobaan menghasilkan **dua penilaian atas dua
 * himpunan drill yang tidak beririsan.**
 *
 * - Kelulusan **lesson** — dari drill yang BUKAN `graduation`, terhadap
 *   `passCriteria` (yang sudah lewat assist ladder). Inilah yang membuka lesson
 *   berikutnya.
 * - Kelulusan **kursus** — dari drill `graduation` saja, terhadap
 *   `GRADUATION_CRITERIA` yang tetap 40 WPM / 95% dan tidak pernah diturunkan.
 *   Ia tidak menggerbangi apa pun: gagal 40 WPM sambil lulus 25 WPM tetap lulus
 *   `u6-review`.
 *
 * 35 dari 36 lesson tidak punya drill `graduation` sama sekali, jadi bagi mereka
 * `graduation` di bawah selalu `null` dan perilakunya persis seperti sebelumnya.
 */

export interface GradedPart {
  result: SessionResult;
  criteria: PassCriteria;
  passed: boolean;
}

export interface GradedAttempt {
  /** Gabungan SELURUH drill — inilah yang disimpan ke `sessions` & `keystats`. */
  combined: SessionResult;
  /** Penilaian lesson. null hanya kalau seluruh drill bertanda `graduation`. */
  lesson: GradedPart | null;
  /** Tes kelulusan kursus. null kalau lesson ini tidak punya drill `graduation`. */
  graduation: GradedPart | null;
}

function grade(
  results: SessionResult[],
  criteria: PassCriteria,
): GradedPart | null {
  const result = combineResults(results);
  if (!result) return null;
  return { result, criteria, passed: meetsCriteria(result.netWPM, result.accuracy, criteria) };
}

/**
 * `results[i]` adalah hasil drill ke-`i`, dan `graduationFlags[i]` perannya.
 * Keduanya datang dari daftar yang sama (`resolveDrills`), jadi panjangnya sama;
 * flag yang hilang dibaca sebagai `false` — sebuah drill tanpa penanda adalah
 * drill biasa, dan itu arah gagal yang aman.
 */
export function gradeAttempt(
  results: SessionResult[],
  graduationFlags: readonly boolean[],
  lessonCriteria: PassCriteria,
): GradedAttempt | null {
  const combined = combineResults(results);
  if (!combined) return null;

  const lessonParts: SessionResult[] = [];
  const graduationParts: SessionResult[] = [];
  results.forEach((r, i) => {
    (graduationFlags[i] === true ? graduationParts : lessonParts).push(r);
  });

  return {
    combined,
    lesson: grade(lessonParts, lessonCriteria),
    graduation: grade(graduationParts, GRADUATION_CRITERIA),
  };
}
