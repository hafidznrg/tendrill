import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Lesson, Unit } from '@/data/curriculum/en/types.ts';
import { weakKeyLabel } from '@/features/adaptive/adaptive.ts';
import { loadAdaptiveReadiness } from '@/features/adaptive/load.ts';
import { nextLessonId, useProgress } from '@/features/curriculum';
import { nextLessonCard, sparklinePoints, weekSummary } from '@/features/home/dashboard.ts';
import { STORAGE_KEYS, read } from '@/lib/storage';
import { hasSeenPosture } from '@/lib/storage/flags.ts';
import { prefetchSessionPath } from '@/app/prefetch.ts';
import { HERO_SAMPLE } from '@/data/home.ts';
import './home-page.css';

/**
 * `/` — hero untuk semua pengguna, dashboard progres di bawahnya (ADR-039).
 *
 * Aturan yang mengikat halaman ini: **tidak ada modal, tidak ada tur produk,
 * tidak ada permintaan izin sebelum keystroke pertama** (dok. 02 §2). Tombol
 * utama ada sejak paint pertama; yang menunggu peta kurikulum hanya isi kartu
 * lesson, dan ruangnya sudah dipesan.
 *
 * Peta kurikulum dimuat di dalam efek, bukan di puncak berkas (dok. 06 §6).
 * Sampai ia datang, "Lanjutkan" menunjuk `/learn` — yang tetap benar.
 */
export default function HomePage() {
  const { progress } = useProgress();
  const [map, setMap] = useState<{ lessons: Lesson[]; units: Unit[] } | null>(null);
  // Dibaca sekali saat render pertama — beberapa `read()` kecil, bukan pekerjaan
  // yang menahan paint. Tidak ada penyimpanan baru (ADR-039 poin 4).
  const [adaptive] = useState(loadAdaptiveReadiness);
  const [week] = useState(() => weekSummary(read(STORAGE_KEYS.keystats).daily, Date.now()));

  useEffect(() => {
    prefetchSessionPath();
    let cancelled = false;
    void import('@/data/curriculum/en/index.ts').then((mod) => {
      if (!cancelled) setMap({ lessons: mod.lessons, units: mod.curriculum.units });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const started = Object.keys(progress.lessons).length > 0;
  // Pengguna yang hanya pernah latihan bebas juga "kembali": progresnya ada di sesi.
  const [hasSessions] = useState(() => read(STORAGE_KEYS.sessions).items.length > 0);
  const returning = started || hasSessions;
  const nextId = map ? nextLessonId(progress, map.lessons) : null;

  // Pengguna baru lewat panduan anchoring dulu (dok. 02 §2, ADR-027). Yang sudah
  // pernah melihatnya tidak pernah disodori lagi — termasuk kalau ia melewatinya.
  const startHref =
    started || hasSeenPosture() ? (nextId ? `/learn/${nextId}` : '/learn') : '/posture';

  return (
    <div className="hp-root">
      <section className="hp-hero">
        <div className="hp-hero-text">
          <p className="hp-label">belajar mengetik sepuluh jari</p>
          <h1 className="hp-title">
            Mengetik tanpa lihat keyboard
          </h1>
          <p className="hp-lede">
            Mulai dari <kbd>f</kbd> dan <kbd>j</kbd> saja. Tombol lain ditambahkan satu per satu.
            Kecepatan tidak dikejar dulu. Yang dilatih letak jarinya.
          </p>
          <div className="hp-actions">
            <Link to={startHref} className="hp-btn hp-btn-primary">
              {started ? 'Lanjutkan' : 'Mulai dari awal'}
            </Link>
            {started ? (
              <Link to="/practice" className="hp-btn">
                Latihan bebas
              </Link>
            ) : (
              <Link to="/placement" className="hp-btn">
                Sudah bisa mengetik? Tes 60 detik
              </Link>
            )}
          </div>
          <Link to="/learn" className="hp-textlink">
            lihat dulu daftar lesson-nya
          </Link>
        </div>
        <HomeRowPanel />
      </section>

      {returning ? (
        <section className="hp-progress" aria-labelledby="hp-progress-title">
          <h2 id="hp-progress-title" className="hp-label hp-rule">
            Progresmu
          </h2>

          <NextLesson progress={progress} map={map} nextId={nextId} />

          <div className="hp-cards">
            <article className="hp-card" aria-labelledby="hp-wpm">
              <h3 id="hp-wpm" className="hp-label">
                WPM · 7 hari
              </h3>
              <p className="hp-big">{week.meanWpm === null ? '—' : Math.round(week.meanWpm)}</p>
              <Sparkline wpm={week.wpm} />
              <p className="hp-dim">rata-rata hari berlatih</p>
            </article>

            {adaptive.ready ? (
              <article className="hp-card" aria-labelledby="hp-weak">
                <h3 id="hp-weak" className="hp-label">
                  Tombol terlemah
                </h3>
                <ul className="hp-weak">
                  {adaptive.weak.slice(0, 3).map((k) => (
                    <li key={k.char}>
                      <kbd className="hp-key">{k.char}</kbd>
                      <span className="hp-dim">{weakKeyLabel(k)}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/practice/adaptive" className="hp-btn hp-btn-small">
                  Latih kelemahanmu
                </Link>
              </article>
            ) : (
              <article className="hp-card" aria-labelledby="hp-weak">
                <h3 id="hp-weak" className="hp-label">
                  Tombol terlemah
                </h3>
                <p className="hp-dim">
                  Latihan dulu beberapa kali. Sesudah itu baru kelihatan tombol mana yang sering
                  meleset.
                </p>
              </article>
            )}

            <article className="hp-card" aria-labelledby="hp-days">
              <h3 id="hp-days" className="hp-label">
                Hari berlatih
              </h3>
              <p className="hp-big">
                {week.practiced}
                <span className="hp-dim hp-unit"> dari 7 hari</span>
              </p>
              <ol className="hp-days" aria-hidden="true">
                {week.wpm.map((v, i) => (
                  <li key={i} data-practiced={v !== null} />
                ))}
              </ol>
              {week.streak > 1 && <p className="hp-dim">beruntun {week.streak} hari</p>}
              <Link to="/stats" className="hp-textlink">
                Lihat statistik
              </Link>
            </article>
          </div>
        </section>
      ) : (
        <ul className="hp-facts">
          <li>
            <strong>36 lesson, urut</strong>
            <span>Tombol baru tidak pernah ditampilkan sebelum letaknya diajarkan.</span>
          </li>
          <li>
            <strong>Ikut tombol yang sering salah</strong>
            <span>Tombol yang sering meleset dicatat, lalu dijadikan bahan latihan.</span>
          </li>
          <li>
            <strong>Tidak perlu akun</strong>
            <span>Progres disimpan di browser ini saja. Tidak dikirim ke mana-mana.</span>
          </li>
        </ul>
      )}
    </div>
  );
}

/** Panel home row statis (ADR-039 poin 1): bukan VirtualKeyboard, tanpa pose. */
const HOME_ROW = [
  ['a', 1],
  ['s', 2],
  ['d', 3],
  ['f', 4],
  ['j', 5],
  ['k', 6],
  ['l', 7],
  [';', 8],
] as const;

function HomeRowPanel() {
  return (
    <div className="hp-panel" aria-hidden="true">
      <div className="hp-row">
        {HOME_ROW.map(([ch, f]) => (
          <span
            key={ch}
            className="hp-cap"
            style={{ borderBottomColor: `var(--f${f})` }}
            data-bump={ch === 'f' || ch === 'j'}
            data-brand={ch === 'd' || ch === 'l'}
          >
            {ch}
          </span>
        ))}
      </div>
      <div className="hp-baseline" />
      <p className="hp-panel-note">
        Raba tonjolan di <b>f</b> dan <b>j</b> — telunjuk selalu pulang ke sini.
      </p>
      <p className="hp-sample">
        <span>{HERO_SAMPLE.typed}</span>
        <span className="hp-sample-rest">{HERO_SAMPLE.rest}</span>
      </p>
    </div>
  );
}

function NextLesson({
  progress,
  map,
  nextId,
}: {
  progress: ReturnType<typeof useProgress>['progress'];
  map: { lessons: Lesson[]; units: Unit[] } | null;
  nextId: string | null;
}) {
  if (!map) return <article className="hp-next" aria-busy="true" />;
  const card = nextLessonCard(progress, map.lessons, map.units, nextId);

  return (
    <article className="hp-next">
      <div className="hp-next-text">
        {card.lesson && card.unit ? (
          <>
            <p className="hp-dim hp-mono">
              Unit {card.unit.order} · {card.unit.title} · lesson {card.position} dari{' '}
              {card.unitTotal}
            </p>
            <h3 className="hp-next-title">{card.lesson.title}</h3>
            <p className="hp-dim">
              Syarat lulus {card.criteria!.minWpm} WPM · {card.criteria!.minAccuracy}% akurasi.
              {card.best &&
                ` Terbaik sejauh ini: ${Math.round(card.best.wpm)} WPM · ${card.best.accuracy.toFixed(1)}%.`}
            </p>
            <Link to={`/learn/${card.lesson.id}`} className="hp-btn hp-btn-outline">
              Buka lesson
            </Link>
          </>
        ) : (
          <>
            <h3 className="hp-next-title">Semua lesson sudah selesai</h3>
            <p className="hp-dim">Latihan bebas dan drill kelemahan tetap terbuka.</p>
          </>
        )}
      </div>
      <div className="hp-units">
        <p className="hp-label hp-units-head">
          <span>Kurikulum</span>
          <span>
            {card.passedCount} / {card.totalCount}
          </span>
        </p>
        <ol className="hp-unit-bars">
          {card.segments.map((s) => (
            <li
              key={s.unitId}
              title={`Unit ${s.order}: ${s.passed}/${s.total}`}
              data-current={card.unit?.id === s.unitId}
            >
              <span
                className="hp-bar"
                style={{ backgroundSize: `${s.total ? (s.passed / s.total) * 100 : 0}% 100%` }}
              />
              <span className="hp-mono">U{s.order}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

const SPARK_W = 260;
const SPARK_H = 56;

function Sparkline({ wpm }: { wpm: (number | null)[] }) {
  const pts = sparklinePoints(wpm, SPARK_W, SPARK_H);
  const last = pts.at(-1);
  return (
    <svg
      className="hp-spark"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1="0" y1={SPARK_H - 1} x2={SPARK_W} y2={SPARK_H - 1} className="hp-spark-base" />
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          className="hp-spark-line"
        />
      )}
      {last && <circle cx={last.x} cy={last.y} r="3.5" className="hp-spark-dot" />}
    </svg>
  );
}
