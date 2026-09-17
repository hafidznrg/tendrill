import { ERROR_RATE_FULL, MIN_KEY_ATTEMPTS, topKeys, type KeyHeat } from '../stats.ts';
import { HeatLegend, HeatmapKeyboard } from './HeatmapKeyboard.tsx';

/** Heatmap kesalahan: `errors / attempts` per tombol (dok. 07 §9). */
export function KeyHeatmap({ heat }: { heat: Map<string, KeyHeat> }) {
  const worst = topKeys(heat, 'errorRate');
  return (
    <section className="st-card st-heatmap" aria-labelledby="hm-error-title">
      <header className="st-card-head">
        <h2 id="hm-error-title" className="st-card-title">
          Kesalahan
        </h2>
        <p className="st-question">Tombol mana yang sering meleset?</p>
      </header>
      <div className="st-card-body">
        <HeatmapKeyboard heat={heat} kind="error" describe={describeError} />
        <p className="st-note" data-testid="error-summary">
          {worst.length === 0
            ? 'Belum ada tombol yang menonjol.'
            : `Paling sering meleset: ${worst.map((h) => `${keyName(h.keyId)} ${Math.round(h.errorRate)}%`).join(' · ')}`}
        </p>
        <HeatLegend kind="error" scale={`0% → ${ERROR_RATE_FULL}% atau lebih`} />
      </div>
    </section>
  );
}

function describeError(h: KeyHeat): string {
  if (h.attempts < MIN_KEY_ATTEMPTS)
    return `${keyName(h.keyId)}: data belum cukup (${h.attempts}×)`;
  return `${keyName(h.keyId)}: ${Math.round(h.errorRate)}% meleset dari ${h.attempts}×`;
}

export function keyName(keyId: string): string {
  return keyId === 'Space' ? 'spasi' : keyId;
}
