import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { TypingStage, diagnose } from '@/features/typing';
import { persistSessionResult } from '@/features/typing/persistSession.ts';
import {
  applyPlacement,
  loadUnitLessons,
  resolveDrillTexts,
  useProgress,
  weakSkippedCluster,
  type PlacementTier,
} from '@/features/curriculum';
import { units } from '@/data/curriculum/en/units.ts';
import type { Lesson } from '@/data/curriculum/en/types.ts';
import type { SessionResult } from '@/lib/engine';
import { installFlushOnHide } from '@/lib/storage';
import { readShowKeyboard } from '@/lib/storage/flags.ts';

/**
 * `/placement` — placement test 60 detik (dok. 02 §2, dok. 04 §3, R-14).
 *
 * Dua hal yang tidak boleh bergeser dari spesifikasinya:
 *
 * 1. **Ia sesi mengetik, bukan formulir.** Tidak ada kuesioner, tidak ada modal,
 *    tidak ada pertanyaan "seberapa cepat kamu?" — karena itu ia memakai
 *    `TypingStage` yang sama dengan lesson biasa.
 * 2. **Selalu bisa dilewati.** Tombolnya ada sejak layar pertama, bukan di
 *    balik "tidak, terima kasih" yang kecil.
 *
 * Hasilnya **saran, bukan vonis** (dok. 02 §2): unit yang dilewati tetap bisa
 * dibuka kapan pun, dan kalau profil error menunjukkan gugus tombol tertentu
 * lemah, halaman ini mengatakannya — bahkan ketika unitnya baru saja dilewati.
 */

interface Outcome {
  result: SessionResult;
  tier: PlacementTier;
  weak: { unitId: string; keys: string[] } | null;
  startLessonId: string;
}

export default function PlacementPage() {
  const navigate = useNavigate();
  const { progress, save } = useProgress();

  const [target, setTarget] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [runId, setRunId] = useState(0);
  // Mengikuti pengaturan tanpa sakelar (ADR-045): placement tidak menambah kontrol.
  const [showKeyboard] = useState(readShowKeyboard);

  useEffect(installFlushOnHide, []);

  useEffect(() => {
    let cancelled = false;
    void loadUnitLessons('u0').then(async (lessons: Lesson[]) => {
      const placement = lessons[0];
      if (cancelled || !placement) return;
      const texts = await resolveDrillTexts(placement);
      if (cancelled) return;
      setTarget(texts[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onFinish = useCallback(
    (result: SessionResult | null) => {
      // Placement yang di-void tidak menempatkan siapa pun: angkanya tidak sah,
      // dan menempatkan orang berdasarkan angka tidak sah lebih buruk daripada
      // tidak menempatkan sama sekali.
      if (result === null) {
        setOutcome(null);
        return;
      }

      void (async () => {
        // Seluruh kurikulum dibutuhkan di sini — dan hanya di sini, setelah
        // pengguna selesai mengetik, jadi ia tidak pernah menghalangi keystroke
        // pertama (dok. 06 §6).
        const all = (
          await Promise.all(units.map((u) => loadUnitLessons(u.id)))
        ).flat();

        const netWpm = +result.netWPM.toFixed(2);
        const accuracy = +result.accuracy.toFixed(2);
        const applied = applyPlacement(progress, all, netWpm, accuracy, Date.now());
        save(applied.progress);

        const startUnit = applied.tier.startUnitId;
        const startLessonId =
          all.find((l) => l.unitId === startUnit && l.kind !== 'placement')?.id ?? 'u1-l1';

        setOutcome({
          result,
          tier: applied.tier,
          weak: weakSkippedCluster(result, all, applied.tier.skippedUnitIds),
          startLessonId,
        });

        persistSessionResult(result, { source: 'lesson', lessonId: 'u0-placement' });
      })();
    },
    [progress, save],
  );

  const retry = useCallback(() => {
    setOutcome(null);
    setRunId((n) => n + 1);
  }, []);

  if (target === null) return <p className="text-fg-dim">memuat placement test…</p>;

  if (outcome) {
    const { result, tier, weak, startLessonId } = outcome;
    const weakUnit = weak ? units.find((u) => u.id === weak.unitId) : undefined;

    return (
      <section>
        <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">Hasil placement</h1>
        <p className="mt-3 max-w-[64ch] text-[15px]">{tier.summary}</p>
        <p className="mt-2 max-w-[64ch] text-fg-dim">
          {Math.round(result.netWPM)} WPM · {result.accuracy.toFixed(1)}% akurasi.{' '}
          {diagnose(result).text}
        </p>

        {weak && weakUnit && (
          <p className="mt-4 max-w-[64ch] border-l-2 border-accent pl-3 text-[15px]">
            Unit {weakUnit.order} dilewati, tapi{' '}
            {/* Dipisah koma dengan sengaja: tanpa pemisah, tiga <kbd> berdempetan
                terbaca sebagai satu "kata" ("shf"), bukan tiga tombol. */}
            {weak.keys.map((k, i) => (
              <span key={k}>
                {i > 0 && ', '}
                <kbd className="ul-key">{k === ' ' ? 'spasi' : k}</kbd>
              </span>
            ))}{' '}
            masih sering meleset — mau latih itu dulu? Unitnya tetap terbuka di{' '}
            <Link to="/learn" className="underline underline-offset-2">
              kurikulum
            </Link>
            .
          </p>
        )}

        {tier.suggestAdaptive && (
          <p className="mt-3 max-w-[64ch] text-fg-dim">
            Di levelmu, latihan adaptif biasanya lebih berguna daripada lesson berurutan —
            ia menyasar tombol yang benar-benar menahan lajumu.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/learn/${startLessonId}`} className="ul-cta ul-cta-primary">
            Mulai dari sini
          </Link>
          <Link to="/learn" className="ul-cta">
            Lihat seluruh kurikulum
          </Link>
          <button type="button" className="ul-cta" onClick={retry}>
            Ulangi placement
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="sr-only">Placement test</h1>
      <TypingStage
        target={target}
        title="Placement test"
        runId={runId}
        onFinish={onFinish}
        onExit={() => void navigate('/learn')}
        showKeyboard={showKeyboard}
        footer={
          // Pengantar ikut turun ke bawah keyboard (ADR-041) — di atas area teks ia
          // mendorong seluruh panggung, dan ini sesi pertama yang dilihat pemula.
          <div className="mt-4 flex flex-col gap-3">
            <p className="border-l-2 border-accent pl-3 text-[13px] leading-snug text-fg-dim">
              Enam puluh detik untuk melihat posisi awalmu. Ketik senyaman biasanya.
              Hasilnya menentukan titik mulai, dan tidak mengunci apa pun.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-[11px] tracking-[0.16em] text-fg-dim uppercase">
                Tab ulangi · Esc keluar
              </p>
              <Link to="/learn/u1-l1" className="ul-hint underline underline-offset-2">
                lewati, mulai dari nol
              </Link>
            </div>
          </div>
        }
      />
    </section>
  );
}
