import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LiveMetrics,
  ResultScreen,
  TypingArea,
  useCharMetrics,
  useTypingSession,
} from '@/features/typing';
import { persistSessionResult, previousBestFor } from '@/features/typing/persistSession.ts';
import { VirtualKeyboard } from '@/features/keyboard';
import { installFlushOnHide, isMemoryMode } from '@/lib/storage';
import type { SessionResult } from '@/lib/engine';

/**
 * Layar sesi lengkap (Fase 2, dok. 02 §4 dan dok. 07 §2).
 *
 * Yang BELUM di sini dan memang milik Fase 3: kriteria kelulusan per lesson,
 * assist ladder, dan tombol "Lanjut" yang tahu lesson berikutnya. Semuanya
 * butuh data kurikulum dan logika unlock yang belum ada.
 */

const COLS = 52; // dok. 07 §2: 50–60 karakter per baris
const LESSON_ID = 'u1-l1';

export default function LessonPage() {
  const [target, setTarget] = useState<string | null>(null);
  const [textEl, setTextEl] = useState<HTMLElement | null>(null);
  const { charWidth, lineHeight, ready } = useCharMetrics(textEl);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [finished, setFinished] = useState(false);
  const previousBest = useRef<{ netWpm: number; accuracy: number } | null>(null);

  // Flush paksa saat tab disembunyikan (dok. 05 §1 poin 4, R-20).
  useEffect(installFlushOnHide, []);

  // Teks latihan tidak pernah di-hardcode di komponen (dok. 06 §2 batasan 3).
  useEffect(() => {
    let cancelled = false;
    void import('@/data/curriculum/en/lessons/unit-1.ts').then((mod) => {
      if (cancelled) return;
      const drill = mod.unit1Lessons[0]?.drills.find((d) => d.content);
      setTarget(drill?.content ?? 'ff jj ff jj fj fj jf jf');
      previousBest.current = previousBestFor(LESSON_ID);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onFinish = useCallback((r: SessionResult | null) => {
    setResult(r);
    setFinished(true);
    // Penulisan dijadwalkan SETELAH layar hasil ter-paint, tidak pernah saat
    // mengetik (dok. 05 §1 poin 4). Sesi yang di-void datang sebagai null dan
    // memang tidak boleh disimpan.
    if (r) persistSessionResult(r, { source: 'lesson', lessonId: LESSON_ID });
  }, []);

  const session = useTypingSession({
    target: target ?? '',
    cols: COLS,
    charWidth,
    lineHeight,
    onFinish,
    enabled: target !== null && ready,
  });

  const { restart, registerNextKeyPainter } = session;
  const handleRetry = useCallback(() => {
    previousBest.current = previousBestFor(LESSON_ID);
    setResult(null);
    setFinished(false);
    restart();
  }, [restart]);

  if (target === null) return <p className="text-fg-dim">memuat latihan…</p>;

  return (
    <section>
      {/* Bilah status sengaja tidak memakai heading — ia berisi angka yang
          berubah 4×/detik. Judul halaman tetap ada untuk screen reader,
          sekaligus menjaga halaman ini punya satu h1 (dok. 07 §8). */}
      <h1 className="sr-only">Unit 1 · Lesson 1</h1>
      <LiveMetrics metrics={session.metrics} title="Unit 1 · Lesson 1" />

      <div className="relative mt-8">
        <TypingArea
          session={session}
          charWidth={charWidth}
          lineHeight={lineHeight}
          onMeasureEl={setTextEl}
        />

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

      <p className="mt-4 font-mono text-[11px] tracking-[0.16em] text-fg-dim uppercase">
        Tab — ulangi · Esc — keluar
      </p>

      {isMemoryMode() && (
        <p className="mt-4 rounded border border-line bg-surface px-3 py-2 text-fg-dim">
          Penyimpanan browser tidak tersedia — progresmu tidak akan tersimpan.
        </p>
      )}

      {finished && (
        <ResultScreen
          result={result}
          voided={session.voided}
          previousBest={previousBest.current}
          onRetry={handleRetry}
        />
      )}
    </section>
  );
}
