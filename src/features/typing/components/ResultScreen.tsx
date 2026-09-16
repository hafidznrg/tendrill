import { useEffect, useMemo, useRef } from 'react';
import type { SessionResult } from '@/lib/engine';
import { diagnose, topProblemKeys } from '../diagnosis.ts';
import './result-screen.css';

/**
 * Layar hasil (dok. 02 §5).
 *
 * Urutannya mengikat dan disusun dari yang paling aktionable: lulus/belum →
 * diagnosis → angka → tombol bermasalah → aksi. Angka WPM sengaja BUKAN yang
 * pertama; ia hal yang paling ingin dilihat pengguna dan paling sedikit
 * memberitahu mereka harus berbuat apa.
 *
 * Nada mengikuti dok. 07 §11: ringkas, faktual, tanpa gamifikasi.
 */

export interface PassCriteria {
  minWpm: number;
  minAccuracy: number;
}

export interface ResultScreenProps {
  result: SessionResult | null;
  /** true = sesi di-void karena diam > 30 detik. */
  voided: boolean;
  /** Kriteria kelulusan lesson. null untuk latihan bebas — murni skor. */
  criteria?: PassCriteria | null;
  /** Percobaan terbaik sebelumnya, untuk pembanding. */
  previousBest?: { netWpm: number; accuracy: number } | null;
  onRetry: () => void;
  onNext?: (() => void) | undefined;
  onExit?: (() => void) | undefined;

  // --- cabang assist ladder (dok. 02 §5, dok. 04 §9) ------------------------
  /** Percobaan ≥ 3: diagnosis diberi bobot visual lebih besar. */
  prominentDiagnosis?: boolean;
  /** Percobaan ≥ 4: catatan bahwa target WPM diturunkan. Akurasi tidak. */
  relaxedNote?: string | null;
  /** Percobaan ≥ 3: drill mikro untuk tombol yang gagal. */
  onMicroDrill?: (() => void) | undefined;
  microDrillLabel?: string;
  /** Percobaan ≥ 6: "lanjut saja" → `passed-with-assist`. */
  onAssistPass?: (() => void) | undefined;

  /**
   * Tes kelulusan kursus (dok. 04 §4a, ADR-030) — hanya `u6-review` mengirimnya.
   * Putusan terpisah: ia TIDAK menggerbangi apa pun, jadi ia muncul di bawah
   * putusan lesson, bukan menggantikannya.
   */
  graduation?: {
    result: SessionResult;
    criteria: PassCriteria;
    passed: boolean;
  } | null;
}

export function ResultScreen({
  result,
  voided,
  criteria = null,
  previousBest = null,
  onRetry,
  onNext,
  onExit,
  prominentDiagnosis = false,
  relaxedNote = null,
  onMicroDrill,
  microDrillLabel = 'Drill 30 detik',
  onAssistPass,
  graduation = null,
}: ResultScreenProps) {
  // Pintasan layar hasil (dok. 07 §7).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        onRetry();
      } else if ((e.key === 'n' || e.key === 'N') && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Escape' && onExit) {
        onExit();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onRetry, onNext, onExit]);

  // Panel hasil menutupi panggung (ADR-041), jadi ia harus menerima fokus — kalau
  // tidak, Tab berikutnya melanjutkan dari tombol yang tersembunyi di belakangnya.
  // Yang difokuskan adalah panelnya, BUKAN tombol pertama: Enter di tombol yang
  // fokus akan menyalakan klik DAN pintasan Enter di atas, dua kali "ulangi".
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);

  // `aria-modal="false"`: panggung di belakangnya memang masih terbaca, dan
  // mengakuinya lebih jujur daripada menyembunyikannya dari screen reader.
  const panelProps = {
    ref: panel,
    className: 'rs-root',
    role: 'dialog' as const,
    'aria-modal': false,
    'aria-label': 'Hasil sesi',
    tabIndex: -1,
    'aria-live': 'polite' as const,
  };

  const diagnosis = useMemo(() => (result ? diagnose(result) : null), [result]);
  const problemKeys = useMemo(() => (result ? topProblemKeys(result) : []), [result]);

  // Sesi yang tidak sah TIDAK menampilkan angka (dok. 02 §5): WPM dari sesi
  // yang dijeda lima menit membingungkan lebih daripada membantu.
  if (voided || !result) {
    return (
      <section {...panelProps}>
        <h2 className="rs-verdict">Sesi tidak dihitung</h2>
        <p className="rs-note">
          Ada jeda lebih dari 30 detik di tengah sesi, jadi kecepatannya tidak lagi
          menggambarkan apa pun. Coba lagi tanpa jeda panjang.
        </p>
        <Actions onRetry={onRetry} onExit={onExit} />
      </section>
    );
  }

  const passed =
    criteria === null ||
    (result.netWPM >= criteria.minWpm && result.accuracy >= criteria.minAccuracy);

  return (
    <section {...panelProps}>
      <h2 className={`rs-verdict${passed ? '' : ' rs-verdict-short'}`}>
        {criteria === null ? 'Selesai' : passed ? 'Lulus' : 'Belum lulus'}
      </h2>

      {criteria !== null && !passed && (
        <p className="rs-note">
          Butuh {criteria.minWpm} WPM & {criteria.minAccuracy}% — kamu dapat{' '}
          {Math.round(result.netWPM)} WPM & {result.accuracy.toFixed(1)}%.
        </p>
      )}

      {diagnosis && (
        <p className={`rs-diagnosis${prominentDiagnosis ? ' rs-diagnosis-strong' : ''}`}>
          {diagnosis.text}
        </p>
      )}

      {/* Percobaan 4–5: target WPM diturunkan 20%, akurasi TIDAK (dok. 04 §9).
          Dikatakan terang-terangan — bantuan yang disembunyikan membuat pengguna
          mengira ia tiba-tiba membaik, dan itu merusak arti angkanya. */}
      {relaxedNote && <p className="rs-assist">{relaxedNote}</p>}

      <dl className="rs-stats">
        <Stat
          label="net wpm"
          value={result.netWPM.toFixed(1)}
          delta={previousBest ? result.netWPM - previousBest.netWpm : null}
        />
        <Stat
          label="akurasi"
          value={`${result.accuracy.toFixed(1)}%`}
          delta={previousBest ? result.accuracy - previousBest.accuracy : null}
        />
        <Stat label="gross wpm" value={result.grossWPM.toFixed(1)} delta={null} />
        <Stat label="konsistensi" value={result.consistency.toFixed(2)} delta={null} />
      </dl>

      {problemKeys.length > 0 && (
        <p className="rs-keys">
          <span className="rs-keys-label">paling bermasalah</span>
          {problemKeys.map((char) => (
            <kbd key={char} className="rs-key">
              {char === ' ' ? 'spasi' : char}
            </kbd>
          ))}
        </p>
      )}

      {graduation && <Graduation {...graduation} />}

      <Actions onRetry={onRetry} onNext={onNext} onExit={onExit} />

      {(onMicroDrill || onAssistPass) && (
        <div className="rs-actions rs-actions-assist">
          {onMicroDrill && (
            <button type="button" className="rs-btn" onClick={onMicroDrill}>
              {microDrillLabel}
            </button>
          )}
          {onAssistPass && (
            <button type="button" className="rs-btn" onClick={onAssistPass}>
              Lanjut saja
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Putusan tes kelulusan kursus (ADR-030).
 *
 * Sengaja di bawah putusan lesson dan dengan kalimat yang menyebut siapa yang
 * membuka lesson berikutnya: dua putusan di satu layar mudah terbaca sebagai
 * kontradiksi ("lulus" di atas, "belum 40 WPM" di bawah) kalau tidak dikatakan
 * mana yang menggerbangi apa.
 *
 * Yang belum lulus tidak disembunyikan dan tidak dihibur. Nadanya dok. 07 §11:
 * faktual, dan menyebutkan bahwa sisanya datang dari pemakaian biasa.
 */
function Graduation({
  result,
  criteria,
  passed,
}: {
  result: SessionResult;
  criteria: PassCriteria;
  passed: boolean;
}) {
  return (
    <section className={`rs-grad${passed ? ' rs-grad-passed' : ''}`}>
      <h3 className="rs-grad-title">
        Tes kelulusan · {criteria.minWpm} WPM · {criteria.minAccuracy}%
      </h3>
      <p className="rs-grad-body">
        {passed ? (
          <>
            Lulus — {result.netWPM.toFixed(1)} WPM &amp; {result.accuracy.toFixed(1)}% pada
            dua drill prosa terakhir. Itu target kursus ini, dan kamu sudah melewatinya.
          </>
        ) : (
          <>
            Belum — {result.netWPM.toFixed(1)} WPM &amp; {result.accuracy.toFixed(1)}% pada
            dua drill prosa terakhir. Ini diukur tanpa drill angka dan simbol, dan ia tidak
            menahan apa pun: kelulusan unit di atas yang menentukan. Sisanya datang dari
            pemakaian biasa.
          </>
        )}
      </p>
    </section>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta: number | null }) {
  // Perbandingan hanya ditampilkan kalau memang berubah bermakna. "+0,0"
  // adalah kebisingan, dan panah merah untuk selisih 0,2 WPM menghukum derau.
  const meaningful = delta !== null && Math.abs(delta) >= 0.5;
  return (
    <div className="rs-stat">
      <dt className="rs-stat-label">{label}</dt>
      <dd className="rs-stat-value">
        {value}
        {meaningful && (
          <span className={`rs-delta${delta > 0 ? ' rs-delta-up' : ''}`}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}
          </span>
        )}
      </dd>
    </div>
  );
}

function Actions({
  onRetry,
  onNext,
  onExit,
}: {
  onRetry: () => void;
  onNext?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
}) {
  return (
    <div className="rs-actions">
      <button type="button" className="rs-btn rs-btn-primary" onClick={onRetry}>
        Ulangi <span className="rs-hint">Enter</span>
      </button>
      {onNext && (
        <button type="button" className="rs-btn" onClick={onNext}>
          Lanjut <span className="rs-hint">N</span>
        </button>
      )}
      {onExit && (
        <button type="button" className="rs-btn" onClick={onExit}>
          Kembali <span className="rs-hint">Esc</span>
        </button>
      )}
    </div>
  );
}
