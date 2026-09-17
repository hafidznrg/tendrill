import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { KeyHeatmap } from '@/features/stats/components/KeyHeatmap.tsx';
import { LatencyHeatmap } from '@/features/stats/components/LatencyHeatmap.tsx';
import { PracticeGrid } from '@/features/stats/components/PracticeGrid.tsx';
import { WpmChart } from '@/features/stats/components/WpmChart.tsx';
import { loadStatsSnapshot } from '@/features/stats/load.ts';
import {
  accuracyRange,
  computeKeyHeat,
  currentStreak,
  practiceDays,
  RECENT_WINDOW,
  summarize,
  wpmRange,
} from '@/features/stats/stats.ts';
import '@/features/stats/components/stats.css';

/**
 * `/stats` (dok. 08 Fase 6, dok. 07 §9–§10).
 *
 * Dimuat lazy lewat `router.tsx` — chunk-nya tidak boleh masuk bundel awal,
 * dan itu dijaga `scripts/check-chunk-graph.ts`, bukan hanya oleh `lazy()`.
 *
 * Data dibaca SEKALI saat halaman dibuka. Tidak ada yang mengubah statistik
 * selagi halaman ini terbuka — sesi hanya berjalan di halaman lain.
 */
export default function StatsPage() {
  const [snapshot] = useState(loadStatsSnapshot);
  const [now] = useState(() => Date.now());
  const { sessions, keystats } = snapshot;

  const heat = useMemo(() => computeKeyHeat(keystats), [keystats]);
  const summary = useMemo(
    () => summarize(sessions, keystats.daily),
    [sessions, keystats.daily],
  );
  const wpm = sessions.map((s) => s.netWpm);
  const accuracy = sessions.map((s) => s.accuracy);

  return (
    <section className="sp-root">
      <div>
        <h1 className="sp-title">Statistik</h1>
        {sessions.length === 0 ? (
          <p className="st-lead">
            Belum ada sesi. Selesaikan satu <Link to="/learn">lesson</Link> atau{' '}
            <Link to="/practice">latihan bebas</Link> — grafik dan heatmap terisi dari situ.
          </p>
        ) : (
          <p className="st-lead">
            Dari {summary.sessions} sesi tersimpan. Angka “terkini” adalah rata-rata{' '}
            {RECENT_WINDOW} sesi terakhir.
          </p>
        )}
      </div>

      <dl className="st-summary">
        <Stat
          hero
          label="wpm terkini"
          value={summary.recentWpm === null ? '—' : `${Math.round(summary.recentWpm)}`}
          note={`rata-rata ${RECENT_WINDOW} sesi`}
        />
        <Stat
          label="akurasi"
          value={
            summary.recentAccuracy === null ? '—' : `${Math.round(summary.recentAccuracy)}%`
          }
          note={`${RECENT_WINDOW} sesi`}
        />
        <Stat
          label="terbaik"
          value={summary.bestWpm === null ? '—' : `${Math.round(summary.bestWpm)}`}
          note="WPM"
        />
        <Stat
          label="sesi"
          value={summary.sessions === 0 ? '—' : `${summary.sessions}`}
          note="tersimpan"
        />
        <Stat label="menit" value={`${summary.totalMinutes}`} note="total" />
      </dl>

      <section className="st-card" aria-labelledby="st-progress-title">
        <header className="st-card-head">
          <h2 id="st-progress-title" className="st-card-title">
            Perkembangan
          </h2>
          <p className="st-question">satu titik per sesi, kiri ke kanan</p>
        </header>
        <div className="st-card-body st-charts">
          <WpmChart
            label="WPM per sesi"
            values={wpm}
            range={wpmRange(wpm)}
            unit=""
            tone="accent"
          />
          <WpmChart
            label="Akurasi per sesi"
            values={accuracy}
            range={accuracyRange(accuracy)}
            unit="%"
            tone="caret"
          />
        </div>
      </section>

      <PracticeGrid
        days={practiceDays(keystats.daily, now)}
        streak={currentStreak(keystats.daily, now)}
      />

      <KeyHeatmap heat={heat} />
      <LatencyHeatmap heat={heat} />
    </section>
  );
}

interface StatProps {
  label: string;
  value: string;
  note: string;
  hero?: boolean;
}

function Stat({ label, value, note, hero = false }: StatProps) {
  return (
    <div className={`st-stat${hero ? ' st-stat-hero' : ''}`}>
      <dt>{label}</dt>
      <dd>
        {value}
        <span className="st-stat-note">{note}</span>
      </dd>
    </div>
  );
}
