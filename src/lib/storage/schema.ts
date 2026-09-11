/**
 * Skema localStorage (dok. 05 §2–§3).
 *
 * Aturan yang mengikat seluruh file ini: **jangan pernah percaya isi
 * localStorage.** Ia bisa rusak, diedit tangan, berasal dari versi app lama,
 * atau berasal dari versi yang lebih baru. Setiap pembacaan divalidasi
 * bentuknya, dan kegagalan apa pun jatuh ke default — bukan melempar error.
 */

export const KEY_PREFIX = 'typing:';

export const STORAGE_KEYS = {
  progress: 'typing:progress',
  sessions: 'typing:sessions',
  keystats: 'typing:keystats',
  settings: 'typing:settings',
  meta: 'typing:meta',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Versi skema saat ini per key. Naikkan bersama migrasi di migrations.ts. */
export const CURRENT_VERSION = 1;

/** Rolling buffer sesi (dok. 05 §2, R-20). */
export const MAX_SESSIONS = 200;
/** Pemangkasan tingkat 1 saat kuota penuh (dok. 05 §4). */
export const TRIMMED_SESSIONS = 100;
export const MAX_DAILY_DAYS = 365;
export const TRIMMED_DAILY_DAYS = 180;
export const MAX_CONFUSIONS = 50;
export const MAX_BIGRAMS = 50;
/** Bigram dengan count di bawah ini terlalu sedikit untuk dipercaya. */
export const MIN_BIGRAM_COUNT = 20;

// --- progress ---------------------------------------------------------------

export type LessonStatus =
  'passed' | 'passed-with-assist' | 'passed-by-placement' | 'attempted' | 'locked';

export interface LessonProgress {
  status: LessonStatus;
  attempts: number;
  bestWpm: number;
  bestAccuracy: number;
  firstPassedAt: number | null;
  lastAttemptAt: number;
}

export interface PlacementRecord {
  takenAt: number;
  netWpm: number;
  accuracy: number;
  unlockedThrough: string | null;
}

export interface ProgressData {
  version: number;
  lessons: Record<string, LessonProgress>;
  placement: PlacementRecord | null;
}

// --- sessions ---------------------------------------------------------------

export type SessionSource = 'lesson' | 'practice';
export type PracticeMode = '15s' | '30s' | '60s' | 'full';

export interface SessionRecord {
  id: string;
  at: number;
  source: SessionSource;
  lessonId?: string;
  mode?: PracticeMode;
  durationMs: number;
  netWpm: number;
  grossWpm: number;
  accuracy: number;
  consistency: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
}

export interface SessionsData {
  version: number;
  items: SessionRecord[];
}

// --- keystats ---------------------------------------------------------------

export interface KeyStat {
  attempts: number;
  errors: number;
  /** akumulasi latensi menuju tombol ini (R-18) */
  totalMs: number;
  slowCount: number;
}

export interface BigramStat {
  sumMs: number;
  count: number;
}

export interface DailyStat {
  sessions: number;
  ms: number;
  avgWpm: number;
  avgAccuracy: number;
}

export interface KeystatsData {
  version: number;
  keys: Record<string, KeyStat>;
  bigrams: Record<string, BigramStat>;
  /** kunci berbentuk "expected>actual" */
  confusions: Record<string, number>;
  /** kunci berbentuk "YYYY-MM-DD" */
  daily: Record<string, DailyStat>;
}

// --- settings & meta --------------------------------------------------------

export interface SettingsData {
  version: number;
  theme: 'system' | 'light' | 'dark';
  soundEnabled: boolean;
  showKeyboard: boolean;
  showFingerGuide: boolean;
  keyboardLayout: 'qwerty';
  contentLanguage: 'en';
}

export interface MetaData {
  version: number;
  schemaVersion: number;
  createdAt: number;
  lastActiveDate: string;
  streakDays: number;
  longestStreak: number;
  /** Tingkat tangga pemangkasan terakhir yang terpakai (dok. 05 §4). */
  lastQuotaTrimLevel?: number;
}

export interface StorageShape {
  'typing:progress': ProgressData;
  'typing:sessions': SessionsData;
  'typing:keystats': KeystatsData;
  'typing:settings': SettingsData;
  'typing:meta': MetaData;
}

// --- default ----------------------------------------------------------------

export function defaultProgress(): ProgressData {
  return { version: CURRENT_VERSION, lessons: {}, placement: null };
}

export function defaultSessions(): SessionsData {
  return { version: CURRENT_VERSION, items: [] };
}

export function defaultKeystats(): KeystatsData {
  return { version: CURRENT_VERSION, keys: {}, bigrams: {}, confusions: {}, daily: {} };
}

export function defaultSettings(): SettingsData {
  return {
    version: CURRENT_VERSION,
    theme: 'system',
    soundEnabled: false,
    showKeyboard: true,
    showFingerGuide: true,
    keyboardLayout: 'qwerty',
    contentLanguage: 'en',
  };
}

export function defaultMeta(): MetaData {
  return {
    version: CURRENT_VERSION,
    schemaVersion: CURRENT_VERSION,
    createdAt: Date.now(),
    lastActiveDate: '',
    streakDays: 0,
    longestStreak: 0,
  };
}

export const DEFAULTS: { [K in StorageKey]: () => StorageShape[K] } = {
  'typing:progress': defaultProgress,
  'typing:sessions': defaultSessions,
  'typing:keystats': defaultKeystats,
  'typing:settings': defaultSettings,
  'typing:meta': defaultMeta,
};

// --- validasi ---------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validator per key. Sengaja memeriksa **field kritikal saja** (dok. 05 §4):
 * cukup untuk menjamin kode di atasnya tidak crash, tanpa berubah menjadi
 * skema-validator lengkap yang akan basi lebih cepat daripada dipelihara.
 */
export const VALIDATORS: { [K in StorageKey]: (v: unknown) => v is StorageShape[K] } = {
  'typing:progress': ((v: unknown): boolean =>
    isObject(v) &&
    isObject(v['lessons']) &&
    (v['placement'] === null || isObject(v['placement']))) as (v: unknown) => v is ProgressData,

  'typing:sessions': ((v: unknown): boolean =>
    isObject(v) &&
    Array.isArray(v['items']) &&
    v['items'].every(
      (item) =>
        isObject(item) &&
        typeof item['id'] === 'string' &&
        isFiniteNumber(item['at']) &&
        isFiniteNumber(item['netWpm']),
    )) as (v: unknown) => v is SessionsData,

  'typing:keystats': ((v: unknown): boolean =>
    isObject(v) &&
    isObject(v['keys']) &&
    isObject(v['confusions']) &&
    isObject(v['daily'])) as (v: unknown) => v is KeystatsData,

  'typing:settings': ((v: unknown): boolean =>
    isObject(v) &&
    (v['theme'] === 'system' || v['theme'] === 'light' || v['theme'] === 'dark')) as (
    v: unknown,
  ) => v is SettingsData,

  'typing:meta': ((v: unknown): boolean => isObject(v) && isFiniteNumber(v['createdAt'])) as (
    v: unknown,
  ) => v is MetaData,
};
