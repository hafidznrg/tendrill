import { MIN_KEY_ATTEMPTS, topKeys, type KeyHeat } from '../stats.ts';
import { HeatmapKeyboard } from './HeatmapKeyboard.tsx';

/** Heatmap kesalahan: `errors / attempts` per tombol (dok. 07 §9). */
export function KeyHeatmap({ heat }: { heat: Map<string, KeyHeat> }) {
  const worst = topKeys(heat, 'errorRate');
  return (
    <section className="st-heatmap" aria-labelledby="hm-error-title">
      <h2 id="hm-error-title" className="st-h2">
        Kesalahan
      </h2>
      <p className="st-question">Tombol mana yang sering meleset?</p>
      <HeatmapKeyboard heat={heat} kind="error" describe={describeError} />
      <p className="st-note" data-testid="error-summary">
        {worst.length === 0
          ? 'Belum ada tombol yang menonjol.'
          : `Paling sering meleset: ${worst.map((h) => `${keyName(h.keyId)} ${Math.round(h.errorRate)}%`).join(' · ')}`}
      </p>
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
