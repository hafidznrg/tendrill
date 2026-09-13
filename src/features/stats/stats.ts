import { hintFor } from '@/features/keyboard/fingerMap.ts';
import { localDateKey } from '@/features/typing/persistSession.ts';
import type { DailyStat, KeystatsData, SessionRecord } from '@/lib/storage/schema.ts';

/**
 * Perhitungan halaman `/stats` (dok. 07 §9–§10, dok. 08 Fase 6).
 *
 * PURE: tanpa React, tanpa storage. Semua keputusan yang bisa salah diam-diam —
 * pembagian nol, skala warna, tombol dengan data sedikit — hidup di sini supaya
 * bisa dites langsung, bukan lewat membaca SVG.
 */

// --- heatmap ------------------------------------------------------------------

/** dok. 07 §9: tombol dengan kemunculan < 10 ditampilkan netral. */
export const MIN_KEY_ATTEMPTS = 10;

/** Tingkat 0–4. `null` = data terlalu sedikit, tampil netral. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | null;

export interface KeyHeat {
  /** Id tombol fisik (`fingerMap.ts`), bukan karakter. */
  keyId: string;
  attempts: number;
  errors: number;
  /** errors / attempts × 100; 0 kalau attempts 0. */
  errorRate: number;
  /** totalMs / attempts; 0 kalau attempts 0. */
  meanMs: number;
  errorLevel: HeatLevel;
  latencyLevel: HeatLevel;
}

/**
 * Tingkat kesalahan yang dianggap "menyala penuh". Skala error **absolut**:
 * 2% salah di tombol mana pun memang kecil, siapa pun penggunanya.
 */
export const ERROR_RATE_FULL = 15;

/**
 * Skala latensi **relatif** terhadap median tombol pengguna sendiri. Skala
 * absolut membuat pemula 15 WPM melihat seluruh keyboard menyala dan pengguna
 * 80 WPM melihatnya padam — keduanya tidak menjawab "tombol mana yang
 * memperlambatku" (dok. 07 §9). 1,6× median = menyala penuh.
 */
export const LATENCY_RATIO_FULL = 1.6;

/**
 * Pita sama lebar, dibulatkan KE BAWAH: seperempat pertama tetap 0. Dengan
 * `ceil`, tombol yang 0,5% lebih lambat dari median sudah menyala — derau
 * dibaca sebagai diagnosis, persis yang dilarang dok. 07 §9. Kontrol negatifnya
 * di `stats.test.ts` ("lambat SERAGAM").
 */
function toLevel(fraction: number): Exclude<HeatLevel, null> {
  if (!(fraction > 0)) return 0; // juga menelan NaN
  return Math.min(4, Math.floor(fraction * 4)) as 0 | 1 | 2 | 3 | 4;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Agregat `keystats` (per KARAKTER) menjadi panas per TOMBOL FISIK.
 *
 * `a` dan `A` satu tombol: heatmap bicara tentang jari, bukan tentang Shift.
 * Karakter yang tidak punya tombol di layout (mis. hasil tempel) dibuang.
 */
export function computeKeyHeat(keystats: KeystatsData): Map<string, KeyHeat> {
  const byKey = new Map<string, { attempts: number; errors: number; totalMs: number }>();
  for (const [char, stat] of Object.entries(keystats.keys)) {
    const hint = hintFor(char);
    if (!hint) continue;
    const acc = byKey.get(hint.keyId) ?? { attempts: 0, errors: 0, totalMs: 0 };
    acc.attempts += finiteOr0(stat.attempts);
    acc.errors += finiteOr0(stat.errors);
    acc.totalMs += finiteOr0(stat.totalMs);
    byKey.set(hint.keyId, acc);
  }

  const out = new Map<string, KeyHeat>();
  for (const [keyId, acc] of byKey) {
    const enough = acc.attempts >= MIN_KEY_ATTEMPTS;
    out.set(keyId, {
      keyId,
      attempts: acc.attempts,
      errors: acc.errors,
      errorRate: acc.attempts > 0 ? Math.min(100, (acc.errors / acc.attempts) * 100) : 0,
      meanMs: acc.attempts > 0 ? acc.totalMs / acc.attempts : 0,
      errorLevel: null,
      latencyLevel: null,
    });
    if (!enough) continue;
    const heat = out.get(keyId)!;
    heat.errorLevel = toLevel(heat.errorRate / ERROR_RATE_FULL);
  }

  // Median hanya dari tombol yang datanya cukup — tombol 3 kemunculan dengan
  // satu jeda berpikir 2 detik tidak boleh menggeser acuan seluruh keyboard.
  const eligible = [...out.values()].filter((h) => h.attempts >= MIN_KEY_ATTEMPTS);
  const ref = median(eligible.map((h) => h.meanMs));
  for (const heat of eligible) {
    // ratio 1 (= median) → 0; LATENCY_RATIO_FULL → 4.
    const fraction = ref > 0 ? (heat.meanMs / ref - 1) / (LATENCY_RATIO_FULL - 1) : 0;
    heat.latencyLevel = toLevel(fraction);
  }
  return out;
}

/** Tombol terlemah menurut satu ukuran — untuk ringkasan teks di bawah heatmap. */
export function topKeys(
  heat: Map<string, KeyHeat>,
  by: 'errorRate' | 'meanMs',
  count = 3,
): KeyHeat[] {
  const level = by === 'errorRate' ? 'errorLevel' : 'latencyLevel';
  return [...heat.values()]
    .filter((h) => h[level] !== null && h[level] > 0)
    .sort((a, b) => b[by] - a[by])
    .slice(0, count);
}

function finiteOr0(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

// --- grafik -------------------------------------------------------------------

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartGeometry {
  points: ChartPoint[];
  /** Atribut `d` untuk garis. Kosong kalau titik < 2 — satu titik bukan garis. */
  path: string;
  yMin: number;
  yMax: number;
  /** Nilai gridline horizontal, dari bawah ke atas. */
  ticks: number[];
}

export interface ChartBox {
  width: number;
  height: number;
  padX: number;
  padY: number;
}

/**
 * Geometri garis untuk `values` (urutan kronologis).
 *
 * Tiga kasus yang dijaga DoD Fase 6: **0** titik → tanpa garis dan tanpa
 * pembagian nol; **1** titik → satu titik di tengah, bukan di `x = NaN`
 * (`i / (n - 1)` dengan n = 1); **200** titik → garis utuh di dalam kotak.
 */
export function chartGeometry(
  values: number[],
  box: ChartBox,
  range: { min: number; max: number },
): ChartGeometry {
  const clean = values.map(finiteOr0);
  const { min: yMin, max: yMax } = range;
  const span = yMax - yMin > 0 ? yMax - yMin : 1;
  const innerW = box.width - box.padX * 2;
  const innerH = box.height - box.padY * 2;
  const n = clean.length;

  const points = clean.map((v, i) => ({
    x: +(box.padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)).toFixed(2),
    y: +(box.padY + innerH - ((clamp(v, yMin, yMax) - yMin) / span) * innerH).toFixed(2),
  }));

  const path =
    points.length < 2
      ? ''
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

  const step = niceStep(span);
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 1e-9; t += step) ticks.push(+t.toFixed(4));

  return { points, path, yMin, yMax, ticks };
}

/** Rentang sumbu Y WPM: 0 sampai kelipatan 10 di atas maksimum, minimal 10. */
export function wpmRange(values: number[]): { min: number; max: number } {
  const max = Math.max(0, ...values.map(finiteOr0));
  return { min: 0, max: Math.max(10, Math.ceil(max / 10) * 10) };
}

/**
 * Rentang sumbu Y akurasi: atap selalu 100, lantai kelipatan 10 di bawah nilai
 * terendah (maks 90). Sumbu 0–100 membuat 92% dan 98% tampak sama rata.
 */
export function accuracyRange(values: number[]): { min: number; max: number } {
  const min = values.length === 0 ? 90 : Math.min(...values.map(finiteOr0));
  return { min: Math.min(90, Math.max(0, Math.floor(min / 10) * 10)), max: 100 };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function niceStep(span: number): number {
  if (span <= 20) return 5;
  if (span <= 50) return 10;
  if (span <= 100) return 20;
  return Math.ceil(span / 5 / 10) * 10;
}

// --- ringkasan & hari berlatih --------------------------------------------------

export interface StatsSummary {
  sessions: number;
  /** rata-rata netWpm 10 sesi terakhir; null kalau belum ada sesi */
  recentWpm: number | null;
  recentAccuracy: number | null;
  bestWpm: number | null;
  /** total menit dari agregat harian — bertahan melewati rolling 200 sesi */
  totalMinutes: number;
}

export const RECENT_WINDOW = 10;

export function summarize(
  sessions: SessionRecord[],
  daily: Record<string, DailyStat>,
): StatsSummary {
  const recent = sessions.slice(-RECENT_WINDOW);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + finiteOr0(x), 0) / xs.length;
  let ms = 0;
  for (const day of Object.values(daily)) ms += finiteOr0(day.ms);
  return {
    sessions: sessions.length,
    recentWpm: recent.length === 0 ? null : mean(recent.map((s) => s.netWpm)),
    recentAccuracy: recent.length === 0 ? null : mean(recent.map((s) => s.accuracy)),
    bestWpm:
      sessions.length === 0 ? null : Math.max(...sessions.map((s) => finiteOr0(s.netWpm))),
    totalMinutes: Math.round(ms / 60000),
  };
}

export interface PracticeDay {
  date: string;
  stat: DailyStat | null;
}

export const PRACTICE_GRID_DAYS = 30;

/** 30 hari terakhir berakhir hari ini, terlama → terbaru (dok. 07 §10). */
export function practiceDays(
  daily: Record<string, DailyStat>,
  now: number,
  days = PRACTICE_GRID_DAYS,
): PracticeDay[] {
  const out: PracticeDay[] = [];
  const today = new Date(now);
  for (let i = days - 1; i >= 0; i--) {
    // Lewat konstruktor kalender, bukan `now - i * 86400000`: hari yang
    // melintasi pergantian DST tidak 24 jam.
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 12);
    const date = localDateKey(d.getTime());
    const stat = daily[date];
    out.push({ date, stat: stat && stat.sessions > 0 ? stat : null });
  }
  return out;
}

/**
 * Streak berjalan, angka sekunder (dok. 07 §10). Hari ini yang belum berlatih
 * **tidak** memutus streak — pagi hari pengguna bukan kegagalan.
 */
export function currentStreak(daily: Record<string, DailyStat>, now: number): number {
  const today = new Date(now);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 12);
    const stat = daily[localDateKey(d.getTime())];
    if (stat && stat.sessions > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}
