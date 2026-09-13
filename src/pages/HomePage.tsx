import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { weakKeyLabel } from '@/features/adaptive/adaptive.ts';
import { loadAdaptiveReadiness } from '@/features/adaptive/load.ts';
import { nextLessonId, useProgress } from '@/features/curriculum';
import { hasSeenPosture } from '@/lib/storage/flags.ts';
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
  // dok. 02 §3: "3 tombol terlemah + [Latih ini]". Dibaca sekali saat render
  // pertama — dua `read()` kecil, bukan pekerjaan yang menahan paint.
  const [adaptive] = useState(loadAdaptiveReadiness);

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

  // Pengguna baru lewat panduan anchoring dulu (dok. 02 §2, ADR-027). Yang sudah
  // pernah melihatnya tidak pernah disodori lagi — termasuk kalau ia melewatinya.
  const startHref =
    started || hasSeenPosture() ? (nextId ? `/learn/${nextId}` : '/learn') : '/posture';

  return (
    <section>
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">tendrill</h1>
      <p className="mt-2 max-w-[60ch] text-fg-dim">
        Belajar mengetik sepuluh jari, berjenjang. Akurasi dulu, kecepatan menyusul sendiri.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Link to={startHref} className="ul-cta ul-cta-primary">
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

      {adaptive.ready && (
        <section className="mt-6 max-w-[60ch]" aria-labelledby="home-weak">
          <h2 id="home-weak" className="font-mono text-[13px] font-bold">
            Tombol terlemah
          </h2>
          <p className="mt-1 text-fg-dim">
            {adaptive.weak.slice(0, 3).map((k, i) => (
              <span key={k.char}>
                {i > 0 && ' · '}
                <kbd className="font-mono text-fg">{k.char}</kbd> {weakKeyLabel(k)}
              </span>
            ))}
          </p>
          <Link to="/practice/adaptive" className="ul-cta mt-3">
            Latih kelemahanmu
          </Link>
        </section>
      )}

      {progress.placement && (
        <p className="mt-6 max-w-[60ch] text-fg-dim">
          Placement terakhir: {Math.round(progress.placement.netWpm)} WPM ·{' '}
          {progress.placement.accuracy.toFixed(1)}% akurasi.
        </p>
      )}
    </section>
  );
}
