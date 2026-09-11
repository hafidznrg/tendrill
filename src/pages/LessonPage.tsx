import { useCallback, useEffect, useMemo, useState } from 'react';
import { TypingArea, useCharMetrics, useTypingSession } from '@/features/typing';
import type { SessionResult } from '@/lib/engine';

/**
 * Layar sesi — versi Fase 1.
 *
 * Yang ADA di sini: teks, caret, status karakter, metrik live, hasil mentah.
 * Yang BELUM: diagnosis, virtual keyboard, kriteria kelulusan, penyimpanan
 * hasil — semuanya Fase 2–3 (dok. 08). Halaman ini sengaja dibiarkan polos
 * supaya yang diuji benar-benar engine-nya, bukan hiasannya.
 */

const COLS = 48;

export default function LessonPage() {
  const [target, setTarget] = useState<string | null>(null);
  const [textEl, setTextEl] = useState<HTMLElement | null>(null);
  const { charWidth, lineHeight, ready } = useCharMetrics(textEl);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [finished, setFinished] = useState(false);

  // Teks latihan tidak pernah di-hardcode di komponen (dok. 06 §2 batasan 3).
  // Import dinamis menjaga data unit tetap di luar bundel awal (dok. 06 §6).
  useEffect(() => {
    let cancelled = false;
    void import('@/data/curriculum/en/lessons/unit-1.ts').then((mod) => {
      if (cancelled) return;
      const drill = mod.unit1Lessons[0]?.drills.find((d) => d.content);
      setTarget(drill?.content ?? 'ff jj ff jj fj fj jf jf');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onFinish = useCallback((r: SessionResult | null) => {
    setResult(r);
    setFinished(true);
  }, []);

  const session = useTypingSession({
    target: target ?? '',
    cols: COLS,
    charWidth,
    lineHeight,
    onFinish,
    enabled: target !== null && ready,
  });

  const restart = session.restart;
  const handleRestart = useCallback(() => {
    setResult(null);
    setFinished(false);
    restart();
  }, [restart]);

  // Enter mengulangi sesi dari layar hasil (dok. 02 §4).
  useEffect(() => {
    if (!finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleRestart();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finished, handleRestart]);

  const stats = useMemo(
    () => [
      { label: 'wpm', value: Math.round(session.metrics.netWPM) },
      { label: 'akurasi', value: `${Math.round(session.metrics.accuracy)}%` },
      { label: 'waktu', value: `${(session.metrics.elapsedMs / 1000).toFixed(1)}s` },
    ],
    [session.metrics],
  );

  if (target === null) return <p className="text-fg-dim">memuat latihan…</p>;

  return (
    <section>
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">Sesi lesson</h1>

      <div className="mt-6 flex gap-8 font-mono">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-[11px] font-medium tracking-[0.16em] text-fg-dim uppercase">
              {s.label}
            </div>
            <div className="text-[28px] font-bold tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="relative mt-6">
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

      <p className="mt-4 font-mono text-[11px] tracking-[0.16em] text-fg-dim uppercase">
        Tab — ulangi · Esc — keluar
      </p>

      {finished && (
        <div className="mt-8 rounded border border-line bg-surface p-5">
          {session.voided || result === null ? (
            <>
              <h2 className="font-mono text-[19px] font-bold">Sesi dibatalkan</h2>
              {/* Sesi yang tidak sah TIDAK menampilkan angka (dok. 02 §5) —
                  WPM dari sesi yang dijeda 30 detik membingungkan, bukan membantu. */}
              <p className="mt-2 text-fg-dim">
                Ada jeda lebih dari 30 detik, jadi hasilnya tidak dihitung.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-mono text-[19px] font-bold">Selesai</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-[13px] sm:grid-cols-4">
                <Stat label="net wpm" value={result.netWPM.toFixed(1)} />
                <Stat label="gross wpm" value={result.grossWPM.toFixed(1)} />
                <Stat label="akurasi" value={`${result.accuracy.toFixed(1)}%`} />
                <Stat label="konsistensi" value={result.consistency.toFixed(2)} />
              </dl>
              {result.confusions.length > 0 && (
                <p className="mt-3 text-fg-dim">
                  Paling sering meleset:{' '}
                  <code className="text-fg">{result.confusions[0]!.expected}</code> diketik
                  sebagai <code className="text-fg">{result.confusions[0]!.actual}</code> (
                  {result.confusions[0]!.count}×)
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={handleRestart}
            className="mt-4 rounded bg-accent px-4 py-2 font-mono text-[13px] font-bold text-bg"
          >
            Ulangi (Enter)
          </button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-[0.16em] text-fg-dim uppercase">{label}</dt>
      <dd className="text-[19px] font-bold tabular-nums">{value}</dd>
    </div>
  );
}
