import { useEffect, useId, useState } from 'react';
import { ALL_KEYS, FINGER_HOME, FINGER_LABEL, handOf, type Finger } from '../fingerMap.ts';
import { HAND_UNIT, KEY_UNITS } from '../hands.ts';
import { loadHandPoses, peekHandPoses, type HandPoses } from '../handPoses.ts';
import { keyName } from '../describe.ts';
import './finger-cards.css';

/**
 * Peta jari per tombol di `/posture` (ADR-038 poin 9–11, dok. 07 §4).
 *
 * Sembilan kartu: tiap jari mendapat keyboard mini dengan tombol miliknya diwarnai,
 * siluet pose jari itu di tombol istirahatnya, dan chip tombolnya. Semuanya
 * diturunkan dari `fingerMap.ts` — tidak ada daftar tombol yang ditulis di sini.
 *
 * Keyboard mini digambar LANGSUNG di ruang keyboard data pose (1 tombol =
 * `HAND_UNIT`), jadi tidak ada pengukuran DOM: pose sudah pas di tombolnya karena
 * generator menjaminnya di ruang yang sama (ADR-037).
 */

/** Urutan grid 3×3: baris tengah memisahkan dua telunjuk yang paling sering tertukar. */
const ORDER: Finger[] = ['f1', 'f2', 'f3', 'f4', 'thumb', 'f5', 'f6', 'f7', 'f8'];

/** Potongan keyboard per sisi, dalam satuan tombol — lebar sama supaya kartu seragam. */
const CROP = { left: { x: -0.7, w: 10 }, right: { x: 5.4, w: 10 } } as const;
const CROP_Y = -0.2;
const CROP_H = 5.5;

/** Spasi di data pose berpusat di tengah keyboard (ADR-037), bukan di awal barisnya. */
const SPACE = { cx: 7.5, cy: 4.5, w: 10 };

export interface FingerCardsProps {
  /** Dipanggil saat chip tombol ditekan — menampilkan tombol itu di keyboard interaktif. */
  onPick?: (keyId: string) => void;
}

export function FingerCards({ onPick }: FingerCardsProps) {
  const [poses, setPoses] = useState<HandPoses | null>(peekHandPoses);
  useEffect(() => {
    if (poses) return;
    let alive = true;
    void loadHandPoses().then((p) => {
      if (alive) setPoses(p);
    });
    return () => {
      alive = false;
    };
  }, [poses]);

  return (
    <ul className="fc-grid">
      {ORDER.map((finger) => (
        <FingerCard key={finger} finger={finger} poses={poses} onPick={onPick} />
      ))}
    </ul>
  );
}

function FingerCard({
  finger,
  poses,
  onPick,
}: {
  finger: Finger;
  poses: HandPoses | null;
  onPick: ((keyId: string) => void) | undefined;
}) {
  const fadeId = useId();
  const hand = handOf(finger);
  const side = hand === 'thumb' ? 'right' : hand;
  const home = FINGER_HOME[finger];
  const keys = ALL_KEYS.filter((k) => k.finger === finger);
  const pose = poses?.[home];
  const crop = CROP[side];
  const u = HAND_UNIT;

  return (
    <li className="fc-card" data-finger={finger}>
      <h3 className="fc-title">
        <span className="fc-swatch" aria-hidden="true" />
        {FINGER_LABEL[finger]}
      </h3>

      <svg
        className="fc-map"
        viewBox={`${crop.x * u} ${CROP_Y * u} ${crop.w * u} ${CROP_H * u}`}
        aria-hidden="true"
      >
        <defs>
          {/* Pergelangan memudar: kartu memotong tangan, jangan sampai terbaca stiker. */}
          <linearGradient id={`${fadeId}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id={`${fadeId}-m`} maskUnits="userSpaceOnUse">
            <rect
              x={crop.x * u}
              y={CROP_Y * u}
              width={crop.w * u}
              height={CROP_H * u}
              fill={`url(#${fadeId}-g)`}
            />
          </mask>
        </defs>

        {ALL_KEYS.map((key) => {
          const unit = key.id === 'Space' ? SPACE : KEY_UNITS.get(key.id)!;
          const own = key.finger === finger;
          return (
            <rect
              key={key.id}
              className={`fc-key${own ? ' fc-own' : ''}${key.id === home ? ' fc-home' : ''}`}
              data-key={key.id}
              x={(unit.cx - unit.w / 2 + 0.06) * u}
              y={(unit.cy - 0.44) * u}
              width={(unit.w - 0.12) * u}
              height={0.88 * u}
              rx={0.12 * u}
            />
          );
        })}

        {pose && (
          <g mask={`url(#${fadeId}-m)`}>
            <path className="fc-skin" d={pose.skin} />
            <path className="fc-line" d={pose.line} />
            <path className="fc-glow" d={pose.hl} />
            <path className="fc-hl" d={pose.hl} />
          </g>
        )}
      </svg>

      <p className="fc-keys">
        {keys.map((key) => (
          <button
            type="button"
            key={key.id}
            className={`fc-chip${key.id === home ? ' fc-chip-home' : ''}`}
            onClick={() => onPick?.(key.id)}
            aria-label={`${keyName(key.id)}${key.id === home ? ', tempat istirahat' : ''}`}
            title={key.id === home ? 'tempat istirahat' : undefined}
          >
            {keyName(key.id)}
          </button>
        ))}
      </p>
    </li>
  );
}
