import { useMemo } from 'react';
import { Link } from 'react-router';
import { curriculum } from '@/data/curriculum/en/index.ts';
import { UnitList, lessonViews, nextLessonId, useProgress } from '@/features/curriculum';
import { isMemoryMode } from '@/lib/storage';

/**
 * `/learn` — daftar kurikulum (dok. 02 §1).
 *
 * Halaman ini mengimpor peta kurikulum LENGKAP, dan itu memang tempatnya
 * (dok. 06 §6): ia satu chunk rute sendiri, jadi 30 lesson tidak pernah ikut ke
 * bundel awal. Yang tidak boleh: layar sesi mengimpor dari sini.
 */
export default function LearnPage() {
  const { progress } = useProgress();

  const views = useMemo(() => lessonViews(progress, curriculum.lessons), [progress]);
  const nextId = useMemo(() => nextLessonId(progress, curriculum.lessons), [progress]);
  const placementTaken = progress.placement !== null;

  return (
    <section>
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">Kurikulum</h1>
      <p className="mt-2 max-w-[62ch] text-fg-dim">
        Tujuh unit, 30 lesson, satu review di akhir tiap unit. Lesson berikutnya terbuka
        setelah yang sebelumnya lulus — kriterianya akurasi dulu, kecepatan belakangan.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {nextId ? (
          <Link to={`/learn/${nextId}`} className="ul-cta ul-cta-primary">
            Lanjutkan
          </Link>
        ) : (
          <p className="mt-3 text-fg-dim">
            Semua lesson sudah lulus. Review session tetap bisa diulang kapan pun.
          </p>
        )}
        {!placementTaken && (
          <Link to="/placement" className="ul-cta">
            Sudah bisa mengetik? Ikut placement
          </Link>
        )}
      </div>

      {isMemoryMode() && (
        <p className="mt-4 rounded border border-line bg-surface px-3 py-2 text-fg-dim">
          Penyimpanan browser tidak tersedia — kelulusan lesson tidak akan tersimpan.
        </p>
      )}

      <UnitList units={curriculum.units} views={views} nextId={nextId} />
    </section>
  );
}
