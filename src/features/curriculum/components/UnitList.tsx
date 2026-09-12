import { Link } from 'react-router';
import type { Lesson, Unit } from '@/data/curriculum/en/types.ts';
import type { LessonStatus } from '@/lib/storage/schema.ts';
import { isPassed, type LessonView } from '../progress.ts';
import './unit-list.css';

/**
 * Daftar unit & lesson untuk `/learn` (dok. 02 §1).
 *
 * Nadanya mengikuti dok. 07 §11: status adalah **teks**, bukan lencana berwarna
 * atau lambang piala. Yang lulus dengan bantuan ditandai halus dan apa adanya
 * (dok. 04 §9) — disembunyikan berarti berbohong, dirayakan berarti menghapus
 * bedanya dengan lulus sungguhan.
 */

const STATUS_LABEL: Record<LessonStatus, string> = {
  passed: 'lulus',
  'passed-with-assist': 'lulus · bantu',
  'passed-by-placement': 'dilewati',
  attempted: 'dicoba',
  locked: '',
};

export interface UnitListProps {
  units: Unit[];
  views: LessonView[];
  /** Lesson yang akan dibuka tombol "lanjutkan" — ditandai di daftar. */
  nextId?: string | null;
}

export function UnitList({ units, views, nextId = null }: UnitListProps) {
  const byUnit = new Map<string, LessonView[]>();
  for (const view of views) {
    const list = byUnit.get(view.lesson.unitId);
    if (list) list.push(view);
    else byUnit.set(view.lesson.unitId, [view]);
  }

  return (
    <div>
      {units.map((unit) => {
        const list = byUnit.get(unit.id) ?? [];
        if (list.length === 0) return null;
        const real = list.filter((v) => v.lesson.kind !== 'placement');
        const passed = real.filter((v) => isPassed(v.status)).length;

        return (
          <section key={unit.id} className="ul-unit" aria-labelledby={`unit-${unit.id}`}>
            <header className="ul-unit-head">
              <h2 id={`unit-${unit.id}`} className="ul-unit-title">
                Unit {unit.order} · {unit.title}
              </h2>
              <p className="ul-unit-summary">{unit.summary}</p>
              <span className="ul-unit-meta">
                {/* Unit 0 tidak punya lesson nyata dan tidak punya kriteria — ia
                    diagnostik. Menampilkan "0 WPM · 0%" di sana hanya membuatnya
                    terlihat seperti unit yang mustahil dilulusi. */}
                {real.length > 0 ? `${passed}/${real.length} lulus` : 'opsional'}
              </span>
            </header>

            <ol className="ul-lessons">
              {list.map((view) => (
                <Row key={view.lesson.id} view={view} isNext={view.lesson.id === nextId} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function Row({ view, isNext }: { view: LessonView; isNext: boolean }) {
  const { lesson, status, unlocked } = view;
  const label = STATUS_LABEL[status] || (isNext ? 'berikutnya' : '');

  const body = (
    <>
      <span className="ul-order">{lesson.kind === 'placement' ? '·' : lesson.order}</span>
      <span className={`ul-title${lesson.kind === 'review' ? ' ul-review' : ''}`}>
        {lesson.title}
      </span>
      <NewKeys lesson={lesson} />
    </>
  );

  return (
    <li className={`ul-row${unlocked ? '' : ' ul-row-locked'}`}>
      {unlocked ? (
        <Link
          to={lesson.kind === 'placement' ? '/placement' : `/learn/${lesson.id}`}
          className="ul-row-link"
        >
          {body}
        </Link>
      ) : (
        // Bukan tombol yang tidak melakukan apa-apa: baris terkunci memang tidak
        // bisa diklik, dan `aria-disabled` pada sesuatu yang tampak seperti
        // tautan justru lebih membingungkan daripada teks biasa.
        <span className="ul-row-link">{body}</span>
      )}
      <span className={`ul-status${isPassed(status) ? ' ul-status-passed' : ''}`}>
        {unlocked ? label : 'terkunci'}
      </span>
    </li>
  );
}

function NewKeys({ lesson }: { lesson: Lesson }) {
  const keys = lesson.newKeys.slice(0, 4);
  if (keys.length === 0) return <span className="ul-keys" />;
  return (
    <span className="ul-keys">
      {keys.map((key) => (
        <kbd key={key} className="ul-key">
          {key === 'Shift' ? '⇧' : key}
        </kbd>
      ))}
    </span>
  );
}
