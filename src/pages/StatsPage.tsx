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
    <section className="st-root">
      <h1 className="st-title">Statistik</h1>

      {sessions.length === 0 && (
        <p className="st-lead">
          Belum ada sesi. Selesaikan satu <Link to="/learn">lesson</Link> atau{' '}
          <Link to="/practice">latihan bebas</Link> — grafik dan heatmap terisi dari situ.
        </p>
      )}

      <dl className="st-summary">
        <Stat label="sesi" value={summary.sessions === 0 ? '—' : `${summary.sessions}`} />
        <Stat
          label="wpm terkini"
          value={summary.recentWpm === null ? '—' : `${Math.round(summary.recentWpm)}`}
        />
        <Stat
          label="akurasi"
          value={
            summary.recentAccuracy === null ? '—' : `${Math.round(summary.recentAccuracy)}%`
          }
        />
        <Stat
          label="terbaik"
          value={summary.bestWpm === null ? '—' : `${Math.round(summary.bestWpm)}`}
        />
        <Stat label="menit" value={`${summary.totalMinutes}`} />
      </dl>

      <WpmChart label="WPM per sesi" values={wpm} range={wpmRange(wpm)} unit="" tone="accent" />
      <WpmChart
        label="Akurasi per sesi"
        values={accuracy}
        range={accuracyRange(accuracy)}
        unit="%"
        tone="caret"
      />

      <PracticeGrid
        days={practiceDays(keystats.daily, now)}
        streak={currentStreak(keystats.daily, now)}
      />

      <div className="st-heatmaps">
        <KeyHeatmap heat={heat} />
        <LatencyHeatmap heat={heat} />
      </div>
      <p className="st-note">Tombol yang diketik kurang dari 10 kali ditampilkan netral.</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="st-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
