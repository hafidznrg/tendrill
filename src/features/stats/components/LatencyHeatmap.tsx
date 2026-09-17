import { LATENCY_RATIO_FULL, MIN_KEY_ATTEMPTS, topKeys, type KeyHeat } from '../stats.ts';
import { HeatLegend, HeatmapKeyboard } from './HeatmapKeyboard.tsx';
import { keyName } from './KeyHeatmap.tsx';

/**
 * Heatmap kelambatan: `totalMs / attempts` per tombol (dok. 07 §9, R-18).
 * Skalanya relatif terhadap median tombol pengguna sendiri — lihat
 * `LATENCY_RATIO_FULL` di `stats.ts`.
 */
export function LatencyHeatmap({ heat }: { heat: Map<string, KeyHeat> }) {
  const slowest = topKeys(heat, 'meanMs');
  return (
    <section className="st-card st-heatmap" aria-labelledby="hm-latency-title">
      <header className="st-card-head">
        <h2 id="hm-latency-title" className="st-card-title">
          Kelambatan
        </h2>
        <p className="st-question">Tombol mana yang memperlambatku?</p>
      </header>
      <div className="st-card-body">
        <HeatmapKeyboard heat={heat} kind="latency" describe={describeLatency} />
        <p className="st-note" data-testid="latency-summary">
          {slowest.length === 0
            ? 'Belum ada tombol yang menonjol.'
            : `Paling lambat: ${slowest.map((h) => `${keyName(h.keyId)} ${Math.round(h.meanMs)} ms`).join(' · ')}`}
        </p>
        <HeatLegend
          kind="latency"
          scale={`median → ${String(LATENCY_RATIO_FULL).replace('.', ',')}× median`}
        />
      </div>
    </section>
  );
}

function describeLatency(h: KeyHeat): string {
  if (h.attempts < MIN_KEY_ATTEMPTS)
    return `${keyName(h.keyId)}: data belum cukup (${h.attempts}×)`;
  return `${keyName(h.keyId)}: rata-rata ${Math.round(h.meanMs)} ms dari ${h.attempts}×`;
}
