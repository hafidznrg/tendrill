import type { LiveMetrics as Metrics } from '@/lib/engine';
import './live-metrics.css';

/**
 * Bilah status sesi (dok. 07 §2).
 *
 * Diletakkan **jauh dari teks target** supaya tidak mencuri perhatian saat
 * mengetik, dan angkanya memakai `tabular-nums` supaya lebarnya tidak pernah
 * berubah — satu-satunya hal yang boleh bergerak di layar sesi adalah caret
 * (dok. 07 §1 prinsip 1 & 2).
 *
 * **Tidak** diberi `aria-live`: metrik yang berubah 4×/detik akan membuat
 * screen reader berbicara terus-menerus (dok. 07 §8).
 */

export interface LiveMetricsProps {
  metrics: Metrics;
  /** Judul kiri, misalnya "Unit 1 · Lesson 1". */
  title?: string;
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = `${Math.floor(total / 60)}`.padStart(2, '0');
  const ss = `${total % 60}`.padStart(2, '0');
  return `${mm}:${ss}`;
}

export function LiveMetrics({ metrics, title }: LiveMetricsProps) {
  return (
    <div className="lm-root">
      <span className="lm-title">{title ?? ''}</span>
      <span className="lm-spacer" />
      <Metric label="waktu" value={formatClock(metrics.elapsedMs)} />
      <Metric label="wpm" value={`${Math.round(metrics.netWPM)}`} />
      <Metric label="akurasi" value={`${Math.round(metrics.accuracy)}%`} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="lm-metric">
      <span className="lm-label">{label}</span>
      <span className="lm-value">{value}</span>
    </span>
  );
}
