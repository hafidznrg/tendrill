import { useCallback, useEffect, useRef, useState } from 'react';
import { HandsToggle, InputModeToggle, ResultScreen, TypingStage } from '@/features/typing';
import { persistSessionResult } from '@/features/typing/persistSession.ts';
import {
  DURATIONS,
  HISTORY_LIMIT,
  SOURCES,
  buildPracticeText,
  durationById,
  recentPracticeSessions,
  sourceById,
  type PracticeSourceId,
} from '@/features/practice';
import type { SessionResult } from '@/lib/engine';
import { installFlushOnHide, isMemoryMode } from '@/lib/storage';
import {
  readInputMode,
  readShowHandsInPractice,
  writeInputMode,
  writeShowHandsInPractice,
} from '@/lib/storage/flags.ts';
import type { InputMode, PracticeMode, SessionRecord } from '@/lib/storage/schema.ts';
import './practice-page.css';

/**
 * `/practice` — latihan bebas (dok. 02 §6, Fase 5).
 *
 * Tiga hal yang membedakannya dari `/learn`, dan ketiganya disengaja:
 *
 * 1. **Tidak ada kriteria lulus.** `ResultScreen` menerima `criteria: null`
 *    sejak Fase 2; layar hasilnya murni skor.
 * 2. **Tidak menyentuh `typing:progress`.** Latihan bebas tidak pernah membuka
 *    lesson dan tidak pernah menutupnya. Yang ditulis hanya `typing:sessions`
 *    dan `typing:keystats` — jadi ia tetap membentuk heatmap dan latihan
 *    adaptif nanti (dok. 02 §6).
 * 3. **Mode timer** (ADR-032): batas waktunya waktu AKTIF, dan teksnya
 *    dibangkitkan lebih panjang daripada yang bisa diketik siapa pun.
 *
 * Wordlist di-`import()` — bukan diimpor statis — supaya chunk `wordlists` baru
 * terunduh saat halaman ini benar-benar dibuka (dok. 06 §6). Dijaga
 * `scripts/check-chunk-graph.ts`, bukan hanya oleh niat baik di file ini.
 */

type Phase = 'setup' | 'typing';

export default function PracticePage() {
  const [durationId, setDurationId] = useState<PracticeMode>('30s');
  const [sourceId, setSourceId] = useState<PracticeSourceId>('words');
  const [phase, setPhase] = useState<Phase>('setup');
  const [text, setText] = useState('');
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [finished, setFinished] = useState(false);
  const [voided, setVoided] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [mode, setMode] = useState<InputMode>(() => readInputMode('practice'));
  const [hands, setHands] = useState(readShowHandsInPractice);
  const changeHands = useCallback((next: boolean) => {
    setHands(next);
    writeShowHandsInPractice(next);
  }, []);

  /** Pool yang sudah terunduh, supaya "ulangi" tidak mengimpor ulang. */
  const poolsRef = useRef<Record<string, string[]> | null>(null);

  useEffect(installFlushOnHide, []);
  useEffect(() => {
    setHistory(recentPracticeSessions());
  }, []);

  const duration = durationById(durationId);
  const source = sourceById(sourceId);

  const begin = useCallback(async () => {
    const pools = poolsRef.current ?? (await import('@/data/wordlists/en')).pools;
    poolsRef.current = pools;
    const pool = pools[source.pool] ?? [];
    setText(buildPracticeText(pool, duration.limitMs));
    setResult(null);
    setFinished(false);
    setVoided(false);
    setPhase('typing');
    setRunId((n) => n + 1);
  }, [duration.limitMs, source.pool]);

  const onFinish = useCallback(
    (r: SessionResult | null) => {
      setFinished(true);
      if (r === null) {
        setVoided(true);
        return;
      }
      setResult(r);
      // Dijadwalkan setelah layar hasil ter-paint, tidak pernah saat mengetik
      // (dok. 05 §1 poin 4). `mode` ikut disimpan supaya riwayat bisa
      // membandingkan sesi yang memang sebanding.
      const record = persistSessionResult(r, { source: 'practice', mode: durationId });
      setHistory((items) => [record, ...items].slice(0, HISTORY_LIMIT));
    },
    [durationId],
  );

  const exit = useCallback(() => {
    setPhase('setup');
    setFinished(false);
    setResult(null);
    setVoided(false);
  }, []);

  const changeMode = useCallback((next: InputMode) => {
    setMode(next);
    writeInputMode('practice', next);
  }, []);

  if (phase === 'typing') {
    return (
      <section>
        <h1 className="sr-only">
          Latihan bebas · {source.label} · {duration.label}
        </h1>

        <TypingStage
          target={text}
          title={`Latihan bebas · ${source.label} · ${duration.label}`}
          runId={runId}
          onFinish={onFinish}
          onExit={exit}
          active={!finished}
          strict={mode === 'strict'}
          showHands={hands}
          limitMs={duration.limitMs}
          footer={
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <InputModeToggle mode={mode} onChange={changeMode} />
              <HandsToggle shown={hands} onChange={changeHands} />
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
      <h1 className="pr-title">Latihan bebas</h1>
      <p className="pr-lead">
        Tanpa kriteria lulus dan tanpa pengaruh ke kurikulum. Hasilnya tetap masuk ke statistik
        tombolmu.
      </p>

      <fieldset className="pr-group">
        <legend className="pr-legend">durasi</legend>
        <div className="pr-choices">
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="pr-choice"
              aria-pressed={d.id === durationId}
              onClick={() => setDurationId(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pr-group">
        <legend className="pr-legend">sumber teks</legend>
        <div className="pr-choices">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="pr-choice"
              aria-pressed={s.id === sourceId}
              onClick={() => setSourceId(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="pr-start" onClick={() => void begin()}>
        Mulai latihan
      </button>

      <section className="pr-history">
        <h2 className="pr-history-title">Riwayat latihan bebas</h2>
        {history.length === 0 ? (
          <p className="pr-empty">Belum ada sesi latihan bebas.</p>
        ) : (
          <table className="pr-table">
            <thead>
              <tr>
                <th scope="col">tanggal</th>
                <th scope="col">durasi</th>
                <th scope="col">wpm</th>
                <th scope="col">akurasi</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.at)}</td>
                  <td>{item.mode ?? '—'}</td>
                  <td>{Math.round(item.netWpm)}</td>
                  <td>{Math.round(item.accuracy)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}

/** Tanggal lokal singkat — riwayat dibaca sekilas, bukan diaudit. */
function formatDate(at: number): string {
  const d = new Date(at);
  const day = `${d.getDate()}`.padStart(2, '0');
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${day}/${month} ${hh}:${mm}`;
}
