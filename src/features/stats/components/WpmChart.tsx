import { chartGeometry, type ChartBox } from '../stats.ts';

/**
 * Grafik garis SVG tulis tangan (R-10: tanpa Recharts). Satu komponen untuk WPM
 * dan akurasi — keduanya garis kronologis, yang berbeda hanya rentang Y-nya.
 *
 * Kotaknya bertinggi tetap sejak paint pertama, termasuk saat kosong: ruang
 * yang tidak dipesan adalah bentuk ketiga layout shift Fase 2.
 */

const BOX: ChartBox = { width: 640, height: 160, padX: 36, padY: 14 };

export interface WpmChartProps {
  label: string;
  values: number[];
  range: { min: number; max: number };
  unit: string;
  /** warna garis: token CSS */
  tone: 'accent' | 'caret';
}

export function WpmChart({ label, values, range, unit, tone }: WpmChartProps) {
  const geo = chartGeometry(values, BOX, range);
  const last = values.at(-1);

  return (
    <figure className="st-chart">
      <figcaption className="st-chart-caption">
        <span>{label}</span>
        {last !== undefined && (
          <span className="st-chart-last">
            terakhir {Math.round(last)}
            {unit}
          </span>
        )}
      </figcaption>
      <svg
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        className="st-chart-svg"
        role="img"
        aria-label={
          values.length === 0
            ? `${label}: belum ada data`
            : `${label}: ${values.length} sesi, terakhir ${Math.round(last!)}${unit}`
        }
      >
        {geo.ticks.map((t) => {
          const ty =
            BOX.padY +
            (BOX.height - BOX.padY * 2) * (1 - (t - geo.yMin) / (geo.yMax - geo.yMin || 1));
          return (
            <g key={t}>
              <line
                x1={BOX.padX}
                x2={BOX.width - BOX.padX}
                y1={ty}
                y2={ty}
                className="st-grid"
              />
              <text
                x={BOX.padX - 6}
                y={ty}
                className="st-tick"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {t}
              </text>
            </g>
          );
        })}
        {geo.path && <path d={geo.path} className={`st-line st-${tone}`} />}
        {/* Titik hanya saat sedikit — 200 lingkaran di 568 px hanya jadi garis tebal. */}
        {geo.points.length <= 30 &&
          geo.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} className={`st-dot st-${tone}`} />
          ))}
        {values.length === 0 && (
          <text
            x={BOX.width / 2}
            y={BOX.height / 2}
            className="st-empty-svg"
            textAnchor="middle"
          >
            belum ada sesi
          </text>
        )}
      </svg>
    </figure>
  );
}
