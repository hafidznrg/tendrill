import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { InputModeToggle, ResultScreen, TypingStage } from '@/features/typing';
import { persistSessionResult, previousBestFor } from '@/features/typing/persistSession.ts';
import { topProblemKeys } from '@/features/typing';
import {
  assistFor,
  effectiveCriteria,
  entryFor,
  gradeAttempt,
  loadLesson,
  markPassedWithAssist,
  meetsCriteria,
  microDrillFor,
  readDrillStats,
  recordAttempt,
  resolveDrills,
  useProgress,
  type LoadedLesson,
  type ResolvedDrill,
} from '@/features/curriculum';
import type { GradedPart } from '@/features/curriculum';
import type { SessionResult } from '@/lib/engine';
import { installFlushOnHide, isMemoryMode } from '@/lib/storage';
import { markGraduated, readInputMode, writeInputMode } from '@/lib/storage/flags.ts';
import type { InputMode } from '@/lib/storage/schema.ts';
import type { PassCriteria } from '@/data/curriculum/en/types.ts';

/**
 * `/learn/:lessonId` — satu sesi lesson (dok. 02 §4).
 *
 * Bentuk yang mengikat halaman ini: **satu lesson = beberapa drill berurutan
 * dalam satu sesi** (dok. 04 §2). Engine hanya mengenal satu target per sesi,
 * jadi tiap drill dijalankan sebagai sesi engine sendiri dan hasil lesson-nya
 * adalah gabungan semuanya. Kelulusan dinilai terhadap gabungan — menilai drill
 * terakhir saja berarti empat drill pertama bisa diabaikan.
 *
 * Satu pengecualian, dan hanya di `u6-review`: drill ber-`graduation: true`
 * dikeluarkan dari penilaian lesson dan dinilai sendiri terhadap 40 WPM / 95%
 * (ADR-030). Pembagiannya dikerjakan `gradeAttempt()` yang pure; halaman ini
 * hanya menampilkan kedua putusannya.
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
  /**
   * Tes kelulusan kursus (ADR-030), hanya ada di `u6-review`. Terpisah dari
   * `passed` di atas: ia tidak menggerbangi apa pun.
   */
  graduation: GradedPart | null;
}

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const navigate = useNavigate();
  const { progress, save } = useProgress();

  const [loaded, setLoaded] = useState<LoadedLesson | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [drills, setDrills] = useState<ResolvedDrill[] | null>(null);
  const [drillIndex, setDrillIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [voided, setVoided] = useState(false);
  /** Drill mikro percobaan ke-3 — di luar penilaian lesson (dok. 04 §9). */
  const [micro, setMicro] = useState<string | null>(null);
  const [microResult, setMicroResult] = useState<SessionResult | null>(null);
  const [microDone, setMicroDone] = useState(false);

  // Mode input (ADR-029). Dibaca sekali saat mount, lalu hidup di state: ia
  // milik pengguna, bukan milik lesson, dan pilihannya bertahan ke lesson
  // berikutnya lewat `typing:settings`.
  const [mode, setMode] = useState<InputMode>(() => readInputMode('learn'));

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
      const resolved = await resolveDrills(found.lesson, readDrillStats());
      if (cancelled) return;
      setLoaded(found);
      setDrills(resolved);
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
        // `runId` ikut naik, dan itu WAJIB — bukan sekadar kerapian.
        // `useTypingSession` hanya membuat sesi baru kalau `target` BERUBAH.
        // Dua drill berturutan yang kebetulan berteks sama karenanya akan
        // membiarkan sesi tetap `finished`: `onFinish` tidak pernah menyala
        // lagi dan layarnya menggantung. Menaikkan `runId` membuat perpindahan
        // drill tidak lagi bergantung pada teksnya berbeda.
        setRunId((n) => n + 1);
        return;
      }

      if (!criteria || !loaded) return;

      // Dua penilaian atas dua himpunan drill yang tidak beririsan (ADR-030):
      // kelulusan lesson dari drill biasa, kelulusan kursus dari drill
      // `graduation`. Di 35 dari 36 lesson himpunan kedua kosong dan `graded.
      // lesson` sama persis dengan gabungan seluruh drill.
      const graded = gradeAttempt(
        doneResults.current,
        all.map((d) => d.graduation),
        criteria,
      );
      if (!graded) return;
      // Seluruh drill bertanda `graduation` tidak mungkin lolos validator, tapi
      // jatuh ke gabungan tetap lebih baik daripada layar hasil yang kosong.
      const lessonPart = graded.lesson ?? {
        result: graded.combined,
        criteria,
        passed: meetsCriteria(graded.combined.netWPM, graded.combined.accuracy, criteria),
      };

      setAttemptResult({
        result: lessonPart.result,
        criteria,
        passed: lessonPart.passed,
        attempt,
        graduation: graded.graduation,
      });

      // Penulisan dijadwalkan SETELAH layar hasil ter-paint, tidak pernah saat
      // mengetik (dok. 05 §1 poin 4). Yang disimpan ke riwayat adalah gabungan
      // SELURUH drill — pengguna memang mengetik semuanya.
      persistSessionResult(graded.combined, { source: 'lesson', lessonId });
      save(
        recordAttempt(progress, lessonId, {
          netWpm: +lessonPart.result.netWPM.toFixed(2),
          accuracy: +lessonPart.result.accuracy.toFixed(2),
          passed: lessonPart.passed,
          at: graded.combined.completedAt,
        }),
      );
      // Ditulis sekali, tidak pernah dicabut (ADR-030).
      if (graded.graduation?.passed) markGraduated(graded.combined.completedAt);
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

  const changeMode = useCallback((next: InputMode) => {
    setMode(next);
    writeInputMode('learn', next);
  }, []);

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

  // Pembanding "terbaik sebelumnya" disembunyikan di lesson yang dinilai dua
  // kali (ADR-030, dok. 02 §5). Angka yang ditampilkan di situ hanya bagian
  // non-graduation, sedangkan riwayat menyimpan gabungan SELURUH drill —
  // termasuk dua drill prosa yang jauh lebih cepat. Panahnya akan menunjuk ke
  // bawah justru saat pengguna membaik. Riwayatnya tidak diubah: yang masuk ke
  // sana harus mewakili apa yang benar-benar diketik (ADR-024).
  const hasGraduationDrill = drills.some((d) => d.graduation);
  const target = micro ?? drills[drillIndex]?.text ?? '';
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
        strict={mode === 'strict'}
        // Kurikulum selalu menampilkan siluet (ADR-036): di sinilah pemula belajar
        // di mana tangan beristirahat.
        showHands
        footer={
          // Mode yang aktif terlihat DI SINI, tanpa membuka pengaturan
          // (ADR-029) — tepat di bawah keyboard, tempat mata pemula berada.
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <InputModeToggle mode={mode} onChange={changeMode} />
            <p className="font-mono text-[11px] tracking-[0.16em] text-fg-dim uppercase">
              target {criteria.minWpm} wpm · {criteria.minAccuracy}% · Tab — ulangi · Esc —
              keluar
            </p>
          </div>
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
          previousBest={hasGraduationDrill ? null : previousBest.current}
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
          graduation={attemptResult?.graduation ?? null}
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
