import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activeElapsedMs,
  applyBackspace,
  applyKey,
  computeLiveMetrics,
  createSession,
  finishSession,
  rewrapSession,
  setInputMode,
  pause,
  restartSession,
  resume,
  type CharState,
  type LiveMetrics,
  type SessionResult,
  type SessionState,
  type SessionStatus,
} from '@/lib/engine';
import { read, STORAGE_KEYS } from '@/lib/storage';
import type { Clicker } from '@/lib/sound/keyClick.ts';
import { useKeyboardCapture } from './useKeyboardCapture.ts';

/**
 * Jembatan engine ↔ React (dok. 06 §4).
 *
 * **Satu-satunya tempat** dunia murni dan dunia React bertemu. Aturan yang
 * mengikat seluruh hook ini (dok. 03 §6):
 *
 * - `SessionState` hidup di `useRef`, tidak pernah di `useState`. Menaruhnya di
 *   state akan menyalin seluruh array karakter tiap keystroke.
 * - **Nol `setState` di jalur keystroke.** Jalur itu hanya menulis `className`
 *   pada 1–2 span dan menggeser `transform` caret.
 * - Metrik live dari akumulator O(1), dipompa rAF bergerbang 250 ms — bukan
 *   `setInterval`, supaya ia berhenti sendiri saat tab tersembunyi (R-09).
 *
 * `setState` hanya dipanggil untuk perubahan STRUKTURAL: ganti target, restart,
 * dan transisi status (idle → running → finished). Itu tiga kali per sesi,
 * bukan tiga kali per detik.
 */

const METRICS_INTERVAL_MS = 250;

/** Kelas CSS per status karakter. Ditulis imperatif, jadi tidak lewat Tailwind JIT. */
export const CHAR_CLASS: Record<CharState, string> = {
  pending: 'ta-pending',
  correct: 'ta-correct',
  incorrect: 'ta-incorrect',
  corrected: 'ta-corrected',
};

const EMPTY_METRICS: LiveMetrics = {
  elapsedMs: 0,
  grossWPM: 0,
  netWPM: 0,
  accuracy: 0,
  progress: 0,
};

export interface UseTypingSessionOptions {
  target: string;
  cols: number;
  charWidth: number;
  lineHeight: number;
  /** Dipanggil sekali saat sesi berakhir. `null` = sesi di-void. */
  onFinish?: (result: SessionResult | null) => void;
  onExit?: () => void;
  enabled?: boolean;
  /** true = mode strict: tombol salah menahan kursor (ADR-029). */
  strict?: boolean;
  /**
   * Batas waktu sesi dalam milidetik **waktu aktif** (ADR-032), atau null/undefined
   * untuk sesi yang berakhir saat targetnya habis — yaitu seluruh lesson.
   */
  limitMs?: number | null;
}

export interface TypingSessionApi {
  status: SessionStatus;
  metrics: LiveMetrics;
  voided: boolean;
  /** Naik hanya saat perubahan struktural — TypingArea membangun ulang span. */
  structuralTick: number;
  sessionRef: React.RefObject<SessionState>;
  registerSpans: (spans: HTMLElement[]) => void;
  registerCaret: (el: HTMLElement | null) => void;
  registerViewport: (el: HTMLElement | null) => void;
  /** Virtual keyboard menitipkan pelukisnya di sini (dok. 07 §4). */
  registerNextKeyPainter: (paint: (char: string | null) => void) => void;
  restart: () => void;
  resumeNow: () => void;
}

export function useTypingSession(options: UseTypingSessionOptions): TypingSessionApi {
  const {
    target,
    cols,
    charWidth,
    lineHeight,
    onFinish,
    onExit,
    enabled = true,
    strict = false,
    limitMs = null,
  } = options;

  // Sesi berbatas waktu dinilai berbeda di akhir (ADR-032), jadi benderanya ikut
  // masuk saat sesi dibuat — bukan ditambahkan belakangan.
  const timed = limitMs !== null;

  const sessionRef = useRef<SessionState>(null as unknown as SessionState);
  if (sessionRef.current === null || sessionRef.current.target !== target) {
    sessionRef.current = createSession(target, cols, { strict, timed });
  }

  const spansRef = useRef<HTMLElement[]>([]);
  const caretRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const nextKeyPainterRef = useRef<((char: string | null) => void) | null>(null);
  const geometryRef = useRef({ charWidth, lineHeight });
  geometryRef.current = { charWidth, lineHeight };

  const [status, setStatus] = useState<SessionStatus>(sessionRef.current.status);
  const [metrics, setMetrics] = useState<LiveMetrics>(EMPTY_METRICS);
  const [voided, setVoided] = useState(false);
  const [structuralTick, setStructuralTick] = useState(0);

  // Sesi baru saat TARGET berubah: bangun ulang struktur, bukan tambal.
  //
  // `cols` sengaja TIDAK ada di daftar dependensi (ADR-028). Sejak lebar baris
  // diturunkan dari pengukuran, `cols` ikut berubah saat jendela diubah
  // ukurannya atau di-zoom — dan membuat sesi baru di situ berarti menghapus
  // ketikan pengguna di tengah drill. Perubahan lebar ditangani efek di bawah.
  const colsRef = useRef(cols);
  useEffect(() => {
    colsRef.current = cols;
    sessionRef.current = createSession(target, cols, {
      strict: strictRef.current,
      timed: timedRef.current,
    });
    setStatus(sessionRef.current.status);
    setMetrics(EMPTY_METRICS);
    setVoided(false);
    setStructuralTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lihat komentar di atas
  }, [target]);

  // Mode diganti di tengah drill: pindahkan benderanya, JANGAN bangun ulang sesi
  // (ADR-029). Membangun ulang akan menghapus ketikan pengguna tepat saat ia
  // mencoba mode yang lain — alasan yang sama dengan ADR-028.
  const timedRef = useRef(timed);
  timedRef.current = timed;

  const strictRef = useRef(strict);
  useEffect(() => {
    strictRef.current = strict;
    setInputMode(sessionRef.current, strict);
  }, [strict]);

  // Lebar berubah → bungkus ulang, jangan mulai ulang (ADR-028).
  useEffect(() => {
    if (colsRef.current === cols) return;
    colsRef.current = cols;
    rewrapSession(sessionRef.current, cols);
    // Perubahan struktural: `TypingArea` memasang ulang <br> di posisi baru.
    // Status ketikan tidak ikut hilang — ia hidup di `cells`, bukan di DOM.
    setStructuralTick((t) => t + 1);
  }, [cols]);

  // --- lapisan imperatif (dok. 03 §7, R-08) ---------------------------------

  /**
   * Satu-satunya tempat manipulasi DOM langsung diizinkan (dok. 06 §2 poin 6).
   *
   * JANGAN "dirapikan" menjadi React idiomatic. `memo` mencegah re-render, bukan
   * reconciliation: merender ulang 500 elemen React per keystroke tetap terjadi,
   * dan itulah yang membuat anggaran p95 ≤ 8 ms jebol.
   */
  const paintDirty = useCallback((dirty: number[]) => {
    const spans = spansRef.current;
    const cells = sessionRef.current.cells;
    for (let i = 0; i < dirty.length; i++) {
      const index = dirty[i]!;
      const span = spans[index];
      if (span) span.className = CHAR_CLASS[cells[index]!.state];
    }
  }, []);

  /** Caret digeser aritmetika — tanpa getBoundingClientRect (dok. 03 §8). */
  const paintCaret = useCallback(() => {
    const s = sessionRef.current;
    const caret = caretRef.current;
    if (!caret) return;

    const { charWidth: cw, lineHeight: lh } = geometryRef.current;
    const starts = s.lineStarts;

    let row = 0;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (starts[i]! <= s.cursor) {
        row = i;
        break;
      }
    }
    const col = s.cursor - starts[row]!;
    caret.style.transform = `translate(${col * cw}px, ${row * lh}px)`;

    // Gulir per baris: satu translate pada kontainer, bukan scrollTop.
    // Teks bergulir hanya setelah baris pertama selesai, jadi pengguna selalu
    // melihat satu baris konteks di atas posisinya (dok. 07 §2).
    const viewport = viewportRef.current;
    if (viewport) {
      const firstVisibleRow = Math.max(0, row - 1);
      viewport.style.transform = `translateY(${-firstVisibleRow * lh}px)`;
    }

    // Sorot tombol berikutnya di virtual keyboard — bagian dari jalur imperatif
    // yang sama, jadi tetap nol pekerjaan React per keystroke.
    const paintKey = nextKeyPainterRef.current;
    if (paintKey) {
      const next = s.cells[s.cursor];
      paintKey(next ? next.expected : null);
    }
  }, []);

  // --- loop metrik (rAF bergerbang 250 ms, R-09) ----------------------------

  useEffect(() => {
    if (status !== 'running') return;

    let raf = 0;
    let last = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < METRICS_INTERVAL_MS) return;
      last = now;
      setMetrics(computeLiveMetrics(sessionRef.current, performance.now()));
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  // --- jalur keystroke ------------------------------------------------------

  const finish = useCallback(() => {
    const s = sessionRef.current;
    const result = finishSession(s, performance.now());
    setStatus('finished');
    setVoided(s.voided);
    // Bilah metrik dibekukan pada titik yang SAMA dengan yang dipakai layar
    // hasil (ADR-032). Tanpa cabang `timed`, sesi berbatas waktu memperlihatkan
    // dua angka sekaligus: 1039 WPM di bilah dan 1,6 WPM di layar hasil —
    // terlihat langsung saat halamannya dibuka.
    const until = s.timed && s.endedAt !== null ? s.endedAt : s.acc.lastKeystrokeAt;
    setMetrics(computeLiveMetrics(s, until));
    onFinish?.(result);
  }, [onFinish]);

  const restart = useCallback(() => {
    restartSession(sessionRef.current);
    setStatus(sessionRef.current.status);
    setMetrics(EMPTY_METRICS);
    setVoided(false);
    setStructuralTick((t) => t + 1);
  }, []);

  const resumeNow = useCallback(() => {
    const s = sessionRef.current;
    if (s.status !== 'paused') return;
    resume(s, performance.now());
    setStatus(s.status);
  }, []);

  // Suara ketik opsional (ADR-035): dibaca sekali saat layar sesi dibuka, dan
  // modulnya hanya diunduh kalau menyala. Ref, bukan state — jalur keystroke
  // tidak boleh memicu render.
  const clickRef = useRef<Clicker | null>(null);
  useEffect(() => {
    if (!read(STORAGE_KEYS.settings).soundEnabled) return;
    let cancelled = false;
    void import('@/lib/sound/keyClick.ts').then((m) => {
      if (!cancelled) clickRef.current = m.createClicker();
    });
    return () => {
      cancelled = true;
      clickRef.current = null;
    };
  }, []);

  const handlers = useMemo(
    () => ({
      onChar: (char: string) => {
        const s = sessionRef.current;
        const wasIdle = s.status === 'idle';
        const wasPaused = s.status === 'paused';

        const outcome = applyKey(s, char, performance.now());
        if (!outcome.accepted) {
          // Satu-satunya cara sebuah keystroke ditolak sambil mengakhiri sesi
          // adalah ambang void 30 detik.
          if (outcome.finished && s.status === 'finished') finish();
          return;
        }

        paintDirty(outcome.dirty);
        if (outcome.cursorMoved) paintCaret();
        clickRef.current?.();

        // Transisi status = perubahan struktural, bukan per-keystroke.
        if (wasIdle || wasPaused) setStatus('running');
        if (outcome.finished) finish();
      },

      onBackspace: () => {
        const s = sessionRef.current;
        const outcome = applyBackspace(s);
        if (!outcome.accepted) return;
        paintDirty(outcome.dirty);
        paintCaret();
      },

      onRestart: restart,
      onExit: () => onExit?.(),
      isActive: () => sessionRef.current.status === 'running',
    }),
    [finish, onExit, paintCaret, paintDirty, restart],
  );

  useKeyboardCapture(handlers, enabled && status !== 'finished');

  // --- batas waktu latihan bebas (ADR-032) ----------------------------------

  // Sisa waktu dihitung ulang dari `activeElapsedMs`, bukan dari jam dinding saat
  // sesi dimulai. Itulah yang membuat pause benar-benar membekukan hitungan
  // mundur, dan yang membuat timer memakai definisi "waktu" yang sama dengan
  // WPM di bilah metrik.
  //
  // Satu `setTimeout` per transisi status — bukan pemeriksaan di jalur
  // keystroke, yang akan melanggar anggaran Fase 1.
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (limitMs === null || status !== 'running') return;
    const remaining = limitMs - activeElapsedMs(sessionRef.current, performance.now());
    const id = setTimeout(
      () => {
        if (sessionRef.current.status === 'running') finishRef.current();
      },
      remaining > 0 ? remaining : 0,
    );
    return () => clearTimeout(id);
  }, [limitMs, status]);

  // --- fokus hilang → pause (R-05) ------------------------------------------

  useEffect(() => {
    if (status !== 'running') return;

    const onBlur = () => {
      const s = sessionRef.current;
      if (s.status !== 'running') return;
      pause(s, performance.now());
      setStatus('paused');
    };

    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [status]);

  // Caret diposisikan ulang saat geometri berubah (font siap, resize, zoom).
  useEffect(() => {
    paintCaret();
  }, [charWidth, lineHeight, structuralTick, paintCaret]);

  const registerSpans = useCallback((spans: HTMLElement[]) => {
    spansRef.current = spans;
  }, []);

  const registerCaret = useCallback((el: HTMLElement | null) => {
    caretRef.current = el;
  }, []);

  const registerViewport = useCallback((el: HTMLElement | null) => {
    viewportRef.current = el;
  }, []);

  const registerNextKeyPainter = useCallback((paint: (char: string | null) => void) => {
    nextKeyPainterRef.current = paint;
    // Sorot tombol pertama begitu keyboard siap — tanpa ini, keyboard baru
    // hidup setelah keystroke pertama, yang justru saat pemula paling butuh.
    const s = sessionRef.current;
    const next = s.cells[s.cursor];
    paint(next ? next.expected : null);
  }, []);

  return {
    status,
    metrics,
    voided,
    structuralTick,
    sessionRef,
    registerSpans,
    registerCaret,
    registerViewport,
    registerNextKeyPainter,
    restart,
    resumeNow,
  };
}
