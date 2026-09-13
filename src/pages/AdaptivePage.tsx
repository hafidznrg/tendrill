import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { InputModeToggle, ResultScreen, TypingStage } from '@/features/typing';
import { persistSessionResult } from '@/features/typing/persistSession.ts';
import {
  MIN_KEY_OCCURRENCES,
  MIN_SESSIONS,
  buildAdaptiveText,
  loadAdaptiveReadiness,
  vocabularyFrom,
  weakKeyLabel,
  type AdaptiveReadiness,
} from '@/features/adaptive';
import type { SessionResult } from '@/lib/engine';
import { installFlushOnHide, isMemoryMode } from '@/lib/storage';
import { readInputMode, writeInputMode } from '@/lib/storage/flags.ts';
import type { InputMode } from '@/lib/storage/schema.ts';
import './practice-page.css';

/**
 * `/practice/adaptive` — "Latih kelemahanmu" (dok. 04 §10, dok. 08 Fase 7).
 *
 * Saudara `/practice`, bukan cabangnya: tanpa kriteria lulus, tanpa menyentuh
 * `typing:progress`, dan mode inputnya ikut pilihan `/practice`. Yang berbeda
 * hanya dari mana teksnya datang.
 *
 * Kesiapan dibaca ULANG tiap kali drill dibangkitkan, bukan sekali saat halaman
 * dibuka: sesi yang baru selesai sudah menggeser statistiknya, dan "ulangi"
 * yang melatih kelemahan kemarin bukan latihan adaptif.
 *
 * Wordlist di-`import()` dinamis (dok. 06 §6) — dijaga `npm run chunkgraph`.
 */

type Phase = 'setup' | 'typing';

export default function AdaptivePage() {
  const [readiness, setReadiness] = useState<AdaptiveReadiness>(loadAdaptiveReadiness);
  const [phase, setPhase] = useState<Phase>('setup');
  const [text, setText] = useState('');
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [voided, setVoided] = useState(false);
  const [mode, setMode] = useState<InputMode>(() => readInputMode('practice'));

  useEffect(installFlushOnHide, []);

  const begin = useCallback(async () => {
    const fresh = loadAdaptiveReadiness();
    setReadiness(fresh);
    if (!fresh.ready) {
      setPhase('setup');
      return;
    }
    const { pools } = await import('@/data/wordlists/en');
    const vocabulary = vocabularyFrom([
      pools['common-200'] ?? [],
      pools['sentences-basic'] ?? [],
      pools['sentences-punct'] ?? [],
    ]);
    setText(buildAdaptiveText({ weak: fresh.weak, vocabulary }));
    setResult(null);
    setFinished(false);
    setVoided(false);
    setPhase('typing');
    setRunId((n) => n + 1);
  }, []);

  const onFinish = useCallback((r: SessionResult | null) => {
    setFinished(true);
    if (r === null) {
      setVoided(true);
      return;
    }
    setResult(r);
    persistSessionResult(r, { source: 'practice', mode: 'adaptive' });
  }, []);

  const exit = useCallback(() => {
    setPhase('setup');
    setFinished(false);
    setResult(null);
    setVoided(false);
    setReadiness(loadAdaptiveReadiness());
  }, []);

  const changeMode = useCallback((next: InputMode) => {
    setMode(next);
    writeInputMode('practice', next);
  }, []);

  if (phase === 'typing') {
    return (
      <section>
        <h1 className="sr-only">Latih kelemahanmu</h1>
        <TypingStage
          target={text}
          title="Latih kelemahanmu"
          runId={runId}
          onFinish={onFinish}
          onExit={exit}
          active={!finished}
          strict={mode === 'strict'}
          limitMs={null}
          footer={
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <InputModeToggle mode={mode} onChange={changeMode} />
              <p className="font-mono text-[11px] tracking-[0.16em] text-fg-dim uppercase">
                tanpa kriteria lulus · Tab — ulangi · Esc — kembali
              </p>
            </div>
          }
        />

        {isMemoryMode() && (
          <p className="mt-4 rounded border border-line bg-surface px-3 py-2 text-fg-dim">
            Penyimpanan browser tidak tersedia — hasilmu tidak akan tersimpan.
          </p>
        )}

        {finished && (
          <ResultScreen
            result={result}
            voided={voided}
            criteria={null}
            previousBest={null}
            onRetry={() => void begin()}
            onExit={exit}
          />
        )}
      </section>
    );
  }

  return (
    <section className="pr-root">
      <h1 className="pr-title">Latih kelemahanmu</h1>

      {readiness.ready ? (
        <>
          <p className="pr-lead">
            Drill kata nyata yang disusun dari tombol dengan skor kesalahan dan kelambatan
            terburukmu. Tanpa kriteria lulus; hasilnya ikut memperbarui statistik.
          </p>
          <ul className="pr-choices" aria-label="tombol terlemah">
            {readiness.weak.map((k) => (
              <li key={k.char} className="pr-choice">
                <kbd className="font-mono">{k.char}</kbd>{' '}
                <span className="text-fg-dim">{weakKeyLabel(k)}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="pr-start" onClick={() => void begin()}>
            Mulai drill
          </button>
        </>
      ) : readiness.reason === 'sessions' ? (
        <p className="pr-lead">
          Latihan adaptif butuh setidaknya {MIN_SESSIONS} sesi tersimpan — kamu baru punya{' '}
          {readiness.sessions}. Selesaikan beberapa <Link to="/learn">lesson</Link> atau{' '}
          <Link to="/practice">latihan bebas</Link> dulu; kelemahan yang ditebak dari data
          sedikit lebih sering salah daripada benar.
        </p>
      ) : (
        <p className="pr-lead">
          Belum ada tombol yang menonjol lemah. Tiap tombol perlu setidaknya{' '}
          {MIN_KEY_OCCURRENCES} kemunculan sebelum dinilai, dan yang sudah dinilai tidak jauh
          dari rata-ratamu sendiri. <Link to="/practice">Latihan bebas</Link> tetap tersedia.
        </p>
      )}
    </section>
  );
}
