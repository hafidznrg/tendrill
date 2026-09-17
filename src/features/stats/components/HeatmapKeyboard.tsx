import { KEYBOARD_ROWS } from '@/features/keyboard/fingerMap.ts';
import { MIN_KEY_ATTEMPTS, type HeatLevel, type KeyHeat } from '../stats.ts';

/**
 * Keyboard statis berwarna panas — dasar bersama `KeyHeatmap` dan
 * `LatencyHeatmap`. Diimpor dari `fingerMap.ts` langsung, bukan dari
 * `@/features/keyboard`, supaya chunk `stats` tidak ikut menarik
 * `VirtualKeyboard` dan CSS-nya.
 *
 * Tidak di jalur keystroke sama sekali, jadi React idiomatic biasa.
 */

export interface HeatmapKeyboardProps {
  heat: Map<string, KeyHeat>;
  kind: 'error' | 'latency';
  /** teks judul tombol (tooltip & label aksesibel) */
  describe: (h: KeyHeat) => string;
}

export function HeatmapKeyboard({ heat, kind, describe }: HeatmapKeyboardProps) {
  return (
    <div className={`hm-root hm-${kind}`}>
      {KEYBOARD_ROWS.map((row, i) => (
        <div className="hm-row" key={i}>
          {row.map((def) => {
            const h = heat.get(def.id);
            const level: HeatLevel | 'none' =
              def.lower === null
                ? 'none'
                : h
                  ? kind === 'error'
                    ? h.errorLevel
                    : h.latencyLevel
                  : null;
            const title =
              def.lower === null
                ? undefined
                : h
                  ? describe(h)
                  : `${def.label || 'spasi'}: belum pernah diketik`;
            return (
              <span
                key={def.id}
                className="hm-key"
                data-key={def.id}
                data-level={level === null ? 'few' : level}
                title={title}
                style={{ flexGrow: def.width ?? 1, flexBasis: `${(def.width ?? 1) * 2.2}rem` }}
              >
                {def.label}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Legenda empat pita + tombol berdata sedikit. `scale` ditulis pemanggil dari
 * konstanta skala (ADR-033) — legenda yang tidak cocok dengan pewarnaannya lebih
 * buruk daripada tanpa legenda.
 */
export function HeatLegend({ kind, scale }: { kind: 'error' | 'latency'; scale: string }) {
  return (
    <p className={`hm-legend hm-${kind}`}>
      <span className="hm-legend-swatches" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span key={level} className="hm-key hm-swatch" data-level={level} />
        ))}
      </span>
      <span>{scale}</span>
      <span className="hm-legend-few">
        <span className="hm-key hm-swatch" data-level="few" aria-hidden="true" />
        data belum cukup (&lt; {MIN_KEY_ATTEMPTS}×)
      </span>
    </p>
  );
}
