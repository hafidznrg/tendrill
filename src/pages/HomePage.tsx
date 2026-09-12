import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { nextLessonId, useProgress } from '@/features/curriculum';
import { prefetchSessionPath } from '@/app/prefetch.ts';

/**
 * `/` — dua pintu masuk (dok. 02 §2–§3).
 *
 * Aturan yang mengikat halaman ini: **tidak ada modal, tidak ada tur produk,
 * tidak ada permintaan izin sebelum keystroke pertama** (dok. 02 §2). Jadi ia
 * hanya dua tautan, dan keduanya berakhir di sesi mengetik.
 *
 * Peta kurikulum dimuat di dalam efek, bukan di puncak berkas: "lanjutkan"
 * butuh urutan lesson, tapi tidak boleh menahan render pertama demi itu
 * (dok. 06 §6). Sampai ia datang, tombolnya menunjuk `/learn` — yang tetap benar.
 */
export default function HomePage() {
  const { progress } = useProgress();
  const [nextId, setNextId] = useState<string | null>(null);

  useEffect(() => {
    prefetchSessionPath();
    let cancelled = false;
    void import('@/data/curriculum/en/index.ts').then((mod) => {
      if (!cancelled) setNextId(nextLessonId(progress, mod.lessons));
    });
    return () => {
      cancelled = true;
    };
  }, [progress]);

  const started = Object.keys(progress.lessons).length > 0;

  return (
    <section>
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">tendrill</h1>
      <p className="mt-2 max-w-[60ch] text-fg-dim">
        Belajar mengetik sepuluh jari, berjenjang. Akurasi dulu, kecepatan menyusul sendiri.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={nextId ? `/learn/${nextId}` : '/learn'}
          className="ul-cta ul-cta-primary"
        >
          {started ? 'Lanjutkan' : 'Mulai dari nol'}
        </Link>
        {!started && (
          <Link to="/placement" className="ul-cta">
            Sudah bisa mengetik?
          </Link>
        )}
        <Link to="/learn" className="ul-cta">
          Kurikulum
        </Link>
      </div>

      {progress.placement && (
        <p className="mt-6 max-w-[60ch] text-fg-dim">
          Placement terakhir: {Math.round(progress.placement.netWpm)} WPM ·{' '}
          {progress.placement.accuracy.toFixed(1)}% akurasi.
        </p>
      )}
    </section>
  );
}
