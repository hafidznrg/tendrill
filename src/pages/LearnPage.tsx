import { useMemo } from 'react';
import { Link } from 'react-router';
import { curriculum } from '@/data/curriculum/en/index.ts';
import {
  Track,
  UnitList,
  isPassed,
  lessonViews,
  nextLessonId,
  useProgress,
} from '@/features/curriculum';
import { isMemoryMode } from '@/lib/storage';
import { graduatedAt } from '@/lib/storage/flags.ts';

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
  // Kelulusan kursus (ADR-030). Dibaca sekali saat render, bukan di-state: ia
  // hanya berubah di layar hasil `u6-review`, dan halaman ini dimuat ulang
  // sesudahnya.
  const graduated = graduatedAt();

  const real = views.filter((v) => v.lesson.kind !== 'placement');
  // Angka dihitung dari data, bukan ditulis tangan: kalimat lama ("tujuh unit, satu
  // review di tiap unit") ikut menghitung Unit 0, yang hanya berisi placement.
  const lessonCount = real.filter((v) => v.lesson.kind === 'lesson').length;
  const reviewCount = real.filter((v) => v.lesson.kind === 'review').length;
  const courseUnits = new Set(real.map((v) => v.lesson.unitId)).size;
  const passedTotal = real.filter((v) => isPassed(v.status)).length;
  const next = nextId ? views.find((v) => v.lesson.id === nextId) : undefined;
  const nextUnit = next ? curriculum.units.find((u) => u.id === next.lesson.unitId) : undefined;

  return (
    <section>
      <div className="lp-head">
        <div>
          <h1 className="lp-title">Kurikulum</h1>
          <p className="lp-lede">
            {courseUnits} unit berisi {lessonCount} lesson, masing-masing ditutup satu review
            ({reviewCount} review). Lesson berikutnya terbuka setelah yang sebelumnya lulus —
            kriterianya akurasi dulu, kecepatan belakangan. Placement di Unit 0 opsional.
          </p>
        </div>
        <p className="lp-total">
          <span className="ul-hint">lulus</span>
          <strong>
            {passedTotal} / {real.length}
          </strong>
        </p>
      </div>

      {/* Peta unit: satu garis per unit, tautan ke kartunya. Angkanya tetap di
          kartu — garis ini hanya membuat "di mana saya" terlihat sekilas. */}
      <nav className="lp-map" aria-label="Kemajuan per unit">
        {curriculum.units.map((unit) => {
          const list = real.filter((v) => v.lesson.unitId === unit.id);
          if (list.length === 0) return null;
          const done = list.filter((v) => isPassed(v.status)).length;
          return (
            <a key={unit.id} href={`#${unit.id}`} className="lp-map-item">
              <Track pct={Math.round((done / list.length) * 100)} />
              <span>
                U{unit.order}
                <span className="sr-only">
                  {' '}
                  {unit.title}, {done} dari {list.length} lulus
                </span>
              </span>
            </a>
          );
        })}
      </nav>

      {next ? (
        <div className="lp-next">
          <div className="lp-next-body">
            <span className="ul-hint">
              Berikutnya{nextUnit ? ` · Unit ${nextUnit.order}` : ''} · {next.lesson.kind === 'review' ? 'review' : `lesson ${next.lesson.order}`}
            </span>
            <p className="lp-next-title">{next.lesson.title}</p>
            <div className="lp-next-meta">
              {next.lesson.newKeys.length > 0 && (
                <span className="lp-next-keys">
                  {next.lesson.newKeys.slice(0, 4).map((key) => (
                    <kbd key={key} className="ul-key lp-key-lg">
                      {key === 'Shift' ? '⇧' : key}
                    </kbd>
                  ))}
                </span>
              )}
              <span>
                lulus di {next.lesson.passCriteria.minWpm} WPM ·{' '}
                {next.lesson.passCriteria.minAccuracy}%
              </span>
              {next.attempts > 0 && <span>{next.attempts} kali dicoba</span>}
            </div>
          </div>
          <Link to={`/learn/${next.lesson.id}`} className="ul-cta ul-cta-primary">
            Lanjutkan
          </Link>
        </div>
      ) : (
        <p className="lp-done">
          Semua lesson sudah lulus. Review session tetap bisa diulang kapan pun.
        </p>
      )}

      <div className="lp-links">
        {!placementTaken && <Link to="/placement">Sudah bisa mengetik? Ikut placement</Link>}
        {/* Panduan anchoring tetap bisa dibuka kapan pun, bukan hanya sekali di
            awal (ADR-027) — posisi tangan adalah hal yang justru perlu ditengok
            lagi setelah beberapa hari. */}
        <Link to="/posture">Panduan posisi tangan</Link>
      </div>

      {graduated !== null && (
        // Faktual, satu baris, tanpa piala — dok. 07 §11. Yang belum lulus tidak
        // melihat apa pun di sini: baris "kamu belum 40 WPM" di halaman daftar
        // adalah pengingat harian yang tidak bisa ditindaklanjuti dari sini.
        <p className="mt-4 max-w-[62ch] border-l-2 border-accent pl-3 text-[15px]">
          Tes kelulusan 40 WPM · 95% sudah lulus pada{' '}
          {new Date(graduated).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          . Review session tetap terbuka kapan pun.
        </p>
      )}

      {isMemoryMode() && (
        <p className="mt-4 rounded border border-line bg-surface px-3 py-2 text-fg-dim">
          Penyimpanan browser tidak tersedia — kelulusan lesson tidak akan tersimpan.
        </p>
      )}

      <UnitList units={curriculum.units} views={views} nextId={nextId} />
    </section>
  );
}
