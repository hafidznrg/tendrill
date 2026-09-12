import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SessionResult } from '@/lib/engine';
import { VirtualKeyboard } from '@/features/keyboard';
import { LiveMetrics } from './LiveMetrics.tsx';
import { TypingArea } from './TypingArea.tsx';
import { useCharMetrics } from '../hooks/useCharMetrics.ts';
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
  /** Baris bantuan di bawah keyboard — beda per halaman. */
  footer?: ReactNode;
  /** false → sesi tidak menerima input (mis. layar hasil sedang tampil). */
  active?: boolean;
  /**
   * true = mode strict (ADR-029). Default false: placement dan latihan bebas
   * mengukur ketikan apa adanya, dan menahan di sana mengubah yang diukur.
   */
  strict?: boolean;
}

export function TypingStage({
  target,
  title,
  runId = 0,
  onFinish,
  onExit,
  footer,
  active = true,
  strict = false,
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
  });

  const { restart, registerNextKeyPainter } = session;

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
        <VirtualKeyboard onReady={registerNextKeyPainter} />
      </div>

      {footer}
    </>
  );
}
