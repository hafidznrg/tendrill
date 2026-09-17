import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionResult } from '@/lib/engine';
import { VirtualKeyboard } from '@/features/keyboard';
import { LiveMetrics } from './LiveMetrics.tsx';
import { TypingArea } from './TypingArea.tsx';
import { useCharMetrics } from '../hooks/useCharMetrics.ts';
import { readFocusMode } from '@/lib/storage/flags.ts';
import { colsFor } from '../cols.ts';
import { useTypingSession } from '../hooks/useTypingSession.ts';

/**
 * Panggung sesi: bilah metrik + teks + virtual keyboard.
 *
 * Diangkat dari `LessonPage` supaya `/placement` memakai panggung yang **sama**
 * (dok. 02 §2: "placement test sendiri adalah sesi mengetik"). Kalau placement
 * memakai panggung sendiri, ia akan menyimpang diam-diam — dan justru ia sesi
 * pertama yang dilihat pengguna baru.
 *
 * Semua aturan performa Fase 1–2 tetap di sini karena mereka hidup di
 * `useTypingSession` dan `TypingArea`: nol re-render dan nol alokasi per
 * keystroke. Komponen ini hanya menyusun, tidak menyentuh jalur input.
 */

export interface TypingStageProps {
  target: string;
  /** Judul di bilah status, misal "Unit 1 · Lesson 1 · drill 2/5". */
  title: string;
  /**
   * Dinaikkan pemanggil untuk memulai ulang sesi dengan target yang SAMA
   * (tombol "ulangi"). Target yang berbeda sudah memulai sesi baru sendiri.
   */
  runId?: number;
  onFinish: (result: SessionResult | null) => void;
  onExit?: () => void;
  /** Baris bantuan di bawah keyboard — beda per halaman. Di sinilah intro lesson
   * tinggal (ADR-041): di bawah keyboard, tidak ada yang boleh menggeser area teks. */
  footer?: ReactNode;
  /**
   * Panel yang dilukis DI ATAS area teks + keyboard (ADR-041) — dipakai layar
   * hasil. Panggung sengaja tetap ter-mount di belakangnya: meng-unmount-nya
   * membuang sesi engine dan memaksa `VirtualKeyboard` mengukur ulang rect
   * tombol yang dipakai siluet tangan (ADR-036).
   */
  overlay?: ReactNode;
  /** false → sesi tidak menerima input (mis. layar hasil sedang tampil). */
  active?: boolean;
  /**
   * true = mode strict (ADR-029). Default false: placement dan latihan bebas
   * mengukur ketikan apa adanya, dan menahan di sana mengubah yang diukur.
   */
  strict?: boolean;
  /** Batas waktu dalam milidetik waktu aktif (ADR-032). null = tanpa batas. */
  limitMs?: number | null;
  /** Siluet tangan di keyboard (ADR-036). Halaman yang memutuskan permukaannya. */
  showHands?: boolean;
}

export function TypingStage({
  target,
  title,
  runId = 0,
  onFinish,
  onExit,
  footer,
  overlay,
  active = true,
  strict = false,
  limitMs = null,
  showHands = false,
}: TypingStageProps) {
  const [textEl, setTextEl] = useState<HTMLElement | null>(null);
  const { charWidth, lineHeight, width, ready } = useCharMetrics(textEl);
  const cols = colsFor(width, charWidth);

  const session = useTypingSession({
    target,
    cols,
    charWidth,
    lineHeight,
    onFinish,
    ...(onExit ? { onExit } : {}),
    enabled: active && ready,
    strict,
    limitMs,
  });

  const { restart, registerNextKeyPainter, status } = session;

  // Mode fokus (ADR-044): dibaca sekali saat mount. Atributnya ditulis di efek
  // yang bergantung pada `status` — transisi yang memang sudah me-render — jadi
  // tidak ada commit tambahan dan jalur keystroke tidak disentuh. CSS yang
  // memudarkan header dan footer; jangan diganti `display: none` (layout shift).
  const [focusMode] = useState(readFocusMode);
  useEffect(() => {
    if (!focusMode) return;
    const root = document.documentElement;
    if (status === 'running') root.dataset['focus'] = 'on';
    else delete root.dataset['focus'];
    return () => {
      delete root.dataset['focus'];
    };
  }, [focusMode, status]);

  // Restart hanya saat runId benar-benar berubah — bukan saat mount, yang akan
  // membuang sesi yang baru saja dibuat.
  const lastRun = useRef(runId);
  useEffect(() => {
    if (lastRun.current === runId) return;
    lastRun.current = runId;
    restart();
  }, [runId, restart]);

  return (
    <>
      <LiveMetrics metrics={session.metrics} title={title} />

      {/* Pembungkus `relative` melingkupi teks DAN keyboard supaya overlay hasil
          menutupi keduanya (ADR-041). Overlay jeda tetap hanya di atas teks — ia
          tombol "klik untuk lanjut", dan menutupi keyboard membuatnya berbohong
          tentang apa yang bisa diklik. */}
      <div className="relative">
        <div className="relative mt-8">
          <TypingArea session={session} charWidth={charWidth} onMeasureEl={setTextEl} />

          {session.status === 'paused' && (
            <button
              type="button"
              onClick={session.resumeNow}
              className="absolute inset-0 flex items-center justify-center bg-bg/85 font-mono text-[13px] text-fg-dim"
            >
              klik atau ketik untuk lanjut
            </button>
          )}
        </div>

        <div className="mt-8">
          <VirtualKeyboard onReady={registerNextKeyPainter} showHands={showHands} />
        </div>

        {overlay}
      </div>

      {/* `display: contents` — tata letak dan urutan DOM sama persis dengan tanpa
          pembungkus (ADR-041); ia hanya kait CSS mode fokus (ADR-044). */}
      <div className="stage-footer">{footer}</div>
    </>
  );
}
