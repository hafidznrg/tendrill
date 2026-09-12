import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ResultScreen, TypingStage } from '@/features/typing';
import { persistSessionResult, previousBestFor } from '@/features/typing/persistSession.ts';
import { topProblemKeys } from '@/features/typing';
import {
  assistFor,
  effectiveCriteria,
  entryFor,
  loadLesson,
  markPassedWithAssist,
  meetsCriteria,
  microDrillFor,
  readDrillStats,
  recordAttempt,
  resolveDrills,
  useProgress,
  type LoadedLesson,
} from '@/features/curriculum';
import { combineResults, type SessionResult } from '@/lib/engine';
import { installFlushOnHide, isMemoryMode } from '@/lib/storage';
import type { PassCriteria } from '@/data/curriculum/en/types.ts';

/**
 * `/learn/:lessonId` — satu sesi lesson (dok. 02 §4).
 *
 * Bentuk yang mengikat halaman ini: **satu lesson = beberapa drill berurutan
 * dalam satu sesi** (dok. 04 §2). Engine hanya mengenal satu target per sesi,
 * jadi tiap drill dijalankan sebagai sesi engine sendiri dan hasil lesson-nya
 * adalah `combineResults` dari semuanya. Kelulusan dinilai terhadap gabungan —
 * menilai drill terakhir saja berarti empat drill pertama bisa diabaikan.
 *
 * Assist ladder (dok. 04 §9) hidup di sini juga, tetapi seluruh keputusannya
 * diambil fungsi pure di `features/curriculum/progress.ts`; halaman ini hanya
 * menampilkan dan menyimpan.
 */

interface AttemptResult {
  result: SessionResult;
  criteria: PassCriteria;
  passed: boolean;
  /** Percobaan ke berapa — dibekukan di sini supaya tidak bergeser setelah disimpan. */
  attempt: number;
}

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();
  const { progress, save } = useProgress();

  const [loaded, setLoaded] = useState<LoadedLesson | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [drills, setDrills] = useState<string[] | null>(null);
  const [drillIndex, setDrillIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [voided, setVoided] = useState(false);
  /** Drill mikro percobaan ke-3 — di luar penilaian lesson (dok. 04 §9). */
  const [micro, setMicro] = useState<string | null>(null);
  const [microResult, setMicroResult] = useState<SessionResult | null>(null);
  const [microDone, setMicroDone] = useState(false);

  const doneResults = useRef<SessionResult[]>([]);
  const previousBest = useRef<{ netWpm: number; accuracy: number } | null>(null);

  // Flush paksa saat tab disembunyikan (dok. 05 §1 poin 4, R-20).
  useEffect(installFlushOnHide, []);

  // Percobaan ke berapa attempt yang SEDANG dikerjakan. Diturunkan dari progres,
  // tidak disimpan di state — satu sumber kebenaran saja.
  const attemptsBefore = entryFor(progress, lessonId)?.attempts ?? 0;
  const attempt = attemptsBefore + 1;

  const baseCriteria = loaded?.lesson.passCriteria ?? null;
  const criteria = useMemo(
    () => (baseCriteria ? effectiveCriteria(baseCriteria, attempt) : null),
    [baseCriteria, attempt],
  );

  // --- muat lesson + bangkitkan drill --------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setNotFound(false);
    setDrills(null);
    setDrillIndex(0);
    setAttemptResult(null);
    setVoided(false);
    setMicro(null);
    doneResults.current = [];

    void loadLesson(lessonId).then(async (found) => {
      if (cancelled) return;
      if (!found) {
        setNotFound(true);
        return;
      }
      previousBest.current = previousBestFor(lessonId);
      // Bobot drill dinamis diambil dari statistik nyata pengguna; kosong →
      // seragam (dok. 04 §7). Dibaca sekali per pemuatan, bukan per drill,
      // supaya seluruh lesson memakai bobot yang konsisten.
      const texts = await resolveDrills(found.lesson, readDrillStats());
      if (cancelled) return;
      setLoaded(found);
      setDrills(texts);
    });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // --- akhir satu drill ----------------------------------------------------
  const onFinish = useCallback(
    (result: SessionResult | null) => {
      if (micro !== null) {
        // Drill mikro tidak dinilai, tidak dicatat, dan tidak menggerakkan
        // assist ladder: ia bantuan, bukan percobaan.
        setMicroResult(result);
        setMicroDone(true);
        return;
      }

      // Sesi di-void (jeda > 30 detik): tidak disimpan, tidak dihitung sebagai
      // percobaan (dok. 03 §5). Menghitungnya akan menggerakkan assist ladder
      // karena pengguna pergi minum, bukan karena ia kesulitan.
      if (result === null) {
        setVoided(true);
        return;
      }

      doneResults.current.push(result);
      const all = drills ?? [];
      if (drillIndex < all.length - 1) {
        setDrillIndex(drillIndex + 1);
        return;
      }

      const combined = combineResults(doneResults.current);
      if (!combined || !criteria || !loaded) return;

      const passed = meetsCriteria(combined.netWPM, combined.accuracy, criteria);
      setAttemptResult({ result: combined, criteria, passed, attempt });

      // Penulisan dijadwalkan SETELAH layar hasil ter-paint, tidak pernah saat
      // mengetik (dok. 05 §1 poin 4).
      persistSessionResult(combined, { source: 'lesson', lessonId });
      save(
        recordAttempt(progress, lessonId, {
          netWpm: +combined.netWPM.toFixed(2),
          accuracy: +combined.accuracy.toFixed(2),
          passed,
          at: combined.completedAt,
        }),
      );
    },
    [attempt, criteria, drillIndex, drills, lessonId, loaded, micro, progress, save],
  );

  // --- aksi layar hasil ----------------------------------------------------
  const startAttempt = useCallback(() => {
    doneResults.current = [];
    previousBest.current = previousBestFor(lessonId);
    setAttemptResult(null);
    setVoided(false);
    setMicro(null);
    setMicroResult(null);
    setMicroDone(false);
    setDrillIndex(0);
    setRunId((n) => n + 1);
  }, [lessonId]);

  const goNext = useCallback(() => {
    const next = loaded?.nextLessonId;
    void navigate(next ? `/learn/${next}` : '/learn');
  }, [loaded, navigate]);

  const goBack = useCallback(() => {
    void navigate('/learn');
  }, [navigate]);

  const startMicroDrill = useCallback(() => {
    if (!loaded || !attemptResult) return;
    const text = microDrillFor(
      loaded.lesson,
      topProblemKeys(attemptResult.result),
      readDrillStats(),
    );
    if (text.length === 0) return;
    setAttemptResult(null);
    setMicroResult(null);
    setMicroDone(false);
    setMicro(text);
    setRunId((n) => n + 1);
  }, [attemptResult, loaded]);

  const assistPass = useCallback(() => {
    save(markPassedWithAssist(progress, lessonId, Date.now()));
    goNext();
  }, [goNext, lessonId, progress, save]);

  // --- render --------------------------------------------------------------
  if (notFound) {
    return (
      <section>
        <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">
          Lesson tidak ditemukan
        </h1>
        <p className="mt-2 max-w-[60ch] text-fg-dim">
          Id <code className="font-mono">{lessonId}</code> tidak ada di kurikulum. Mungkin ia
          berganti nama di versi yang lebih baru — progresmu tidak hilang, hanya tidak
          ditampilkan di sini.
        </p>
        <button type="button" className="ul-cta" onClick={goBack}>
          Kembali ke kurikulum
        </button>
      </section>
    );
  }

  if (!loaded || !drills || drills.length === 0 || !criteria) {
    return <p className="text-fg-dim">memuat latihan…</p>;
  }

  const { lesson, unit } = loaded;

  // Tangga bantuan di layar hasil memakai percobaan yang BARU SAJA dikerjakan,
  // bukan `attempt` yang sedang berjalan. Keduanya berbeda tepat setelah hasil
  // dicatat: `recordAttempt` sudah menaikkan `attempts`, jadi `attempt` di sini
  // sudah menunjuk percobaan BERIKUTNYA. Memakainya akan menampilkan bantuan
  // satu tingkat terlalu cepat — tawaran "lanjut saja" muncul di percobaan ke-5,
  // dan catatan "target diturunkan" muncul di percobaan yang targetnya belum
  // diturunkan. Ditemukan `learnFlow.test.tsx`.
  const shownAssist = assistFor(attemptResult?.attempt ?? attempt);
  const target = micro ?? drills[drillIndex] ?? '';
  const title = micro
    ? `${lesson.title} · drill mikro`
    : `Unit ${unit.order} · ${lesson.title} · drill ${drillIndex + 1}/${drills.length}`;
  const finished = attemptResult !== null || voided || microDone;

  return (
    <section>
      {/* Bilah status berisi angka yang berubah 4×/detik, jadi ia bukan heading.
          Judul halaman tetap ada untuk screen reader (dok. 07 §8). */}
      <h1 className="sr-only">
        Unit {unit.order} · {lesson.title}
      </h1>

      {lesson.intro && !finished && (
        <p className="mb-6 max-w-[68ch] border-l-2 border-accent pl-3 text-[15px]">
          {lesson.intro}
        </p>
      )}

      <TypingStage
        target={target}
        title={title}
        runId={runId}
        onFinish={onFinish}
        onExit={goBack}
        active={!finished}
        footer={
          <p className="mt-4 font-mono text-[11px] tracking-[0.16em] text-fg-dim uppercase">
            target {criteria.minWpm} wpm · {criteria.minAccuracy}% · Tab — ulangi · Esc — keluar
          </p>
        }
      />

      {isMemoryMode() && (
        <p className="mt-4 rounded border border-line bg-surface px-3 py-2 text-fg-dim">
          Penyimpanan browser tidak tersedia — progresmu tidak akan tersimpan.
        </p>
      )}

      {micro !== null && microDone && (
        <ResultScreen
          result={microResult}
          voided={microResult === null}
          onRetry={startMicroDrill}
          onNext={startAttempt}
          onExit={goBack}
        />
      )}

      {micro === null && (voided || attemptResult) && (
        <ResultScreen
          result={attemptResult?.result ?? null}
          voided={voided}
          criteria={attemptResult?.criteria ?? null}
          previousBest={previousBest.current}
          onRetry={startAttempt}
          onNext={attemptResult?.passed ? goNext : undefined}
          onExit={goBack}
          prominentDiagnosis={
            !voided && shownAssist.prominentDiagnosis && !attemptResult?.passed
          }
          relaxedNote={
            !voided && shownAssist.wpmRelaxed && attemptResult && !attemptResult.passed
              ? `Target kecepatan diturunkan ke ${attemptResult.criteria.minWpm} WPM (dari ${lesson.passCriteria.minWpm}) karena ini percobaan ke-${attemptResult.attempt}. Akurasinya tetap ${attemptResult.criteria.minAccuracy}% — kecepatan boleh menunggu, ketepatan tidak.`
              : null
          }
          onMicroDrill={
            shownAssist.offerMicroDrill && attemptResult && !attemptResult.passed
              ? startMicroDrill
              : undefined
          }
          microDrillLabel={microDrillLabel(attemptResult?.result ?? null)}
          onAssistPass={
            shownAssist.offerSkip && attemptResult && !attemptResult.passed
              ? assistPass
              : undefined
          }
        />
      )}
    </section>
  );
}

/**
 * Label tombol drill mikro, menyebut tombolnya (dok. 02 §5: "Drill 30 detik
 * untuk `a` dan `;`"). Menyebutkan tombolnya yang membuat tawaran ini terasa
 * spesifik, bukan seperti tombol bantuan generik.
 */
function microDrillLabel(result: SessionResult | null): string {
  const keys = result ? topProblemKeys(result, 2) : [];
  if (keys.length === 0) return 'Drill 30 detik';
  const shown = keys.map((k) => (k === ' ' ? 'spasi' : k)).join(' dan ');
  return `Drill 30 detik untuk ${shown}`;
}
