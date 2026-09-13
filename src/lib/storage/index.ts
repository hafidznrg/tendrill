import { migrate } from './migrations.ts';
import { readStoredTheme, writeTheme } from './theme.ts';
import {
  CURRENT_VERSION,
  DEFAULTS,
  MAX_CONFUSIONS,
  MAX_DAILY_DAYS,
  MAX_SESSIONS,
  STORAGE_KEYS,
  TRIMMED_DAILY_DAYS,
  TRIMMED_SESSIONS,
  VALIDATORS,
  type KeystatsData,
  type ProgressData,
  type SessionsData,
  type StorageKey,
  type StorageShape,
} from './schema.ts';

/**
 * Lapisan akses penyimpanan (dok. 05 §4).
 *
 * **Satu-satunya tempat di seluruh aplikasi yang boleh menyentuh
 * `localStorage`** (dok. 06 §2 batasan 2, ditegakkan ESLint). Komponen memanggil
 * `read`/`write`, bukan `localStorage` langsung — itulah yang membuat mode
 * memori, migrasi, dan tangga kuota bisa ada sama sekali.
 */

// --- backend ----------------------------------------------------------------

const memory = new Map<string, string>();
let memoryMode = false;

/** localStorage bisa dilarang total (mode privat, kebijakan browser). */
function probeLocalStorage(): boolean {
  try {
    const probe = '__tendrill_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

if (!probeLocalStorage()) memoryMode = true;

/**
 * true → progres TIDAK akan tersimpan. UI wajib menampilkan banner
 * (dok. 05 §4) alih-alih diam-diam kehilangan data pengguna.
 */
export function isMemoryMode(): boolean {
  return memoryMode;
}

/** Dipakai test untuk mengembalikan modul ke keadaan bersih. */
export function _resetForTests(): void {
  memory.clear();
  memoryMode = !probeLocalStorage();
  pending.clear();
  if (idleHandle !== null) {
    cancelIdle(idleHandle);
    idleHandle = null;
  }
}

function rawGet(key: string): string | null {
  if (memoryMode) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    memoryMode = true;
    return memory.get(key) ?? null;
  }
}

function rawSet(key: string, value: string): void {
  if (memoryMode) {
    memory.set(key, value);
    return;
  }
  localStorage.setItem(key, value);
}

function rawRemove(key: string): void {
  memory.delete(key);
  if (memoryMode) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* tidak ada yang bisa dilakukan; biarkan */
  }
}

// --- baca -------------------------------------------------------------------

/**
 * Baca satu key. **Tidak pernah melempar.** Setiap kegagalan — key belum ada,
 * JSON rusak, bentuk tidak sesuai, versi dari masa depan — jatuh ke default.
 */
export function read<K extends StorageKey>(key: K): StorageShape[K] {
  const fallback = DEFAULTS[key]() as StorageShape[K];

  // Tulisan yang masih menunggu browser senggang adalah kebenaran TERBARU
  // (R-20). Tanpa baris ini, dua sesi yang selesai di dalam satu jendela idle
  // membuat yang kedua membaca keadaan sebelum yang pertama — lalu menimpanya,
  // dan sesi pertama hilang tanpa jejak. Dibuktikan `storage.test.ts`.
  const queued = pending.get(key);
  if (queued !== undefined) return queued as StorageShape[K];

  const raw = rawGet(key);
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback;

  const migrated = migrate(key, parsed as Record<string, unknown>);
  // Data dari versi app yang lebih baru: pakai default, tapi JANGAN menimpa —
  // penulisan berikutnya yang akan menimpanya, dan itu keputusan pengguna.
  if (!migrated.ok) return fallback;

  const validate = VALIDATORS[key];
  return validate(migrated.data) ? (migrated.data as StorageShape[K]) : fallback;
}

// --- tulis + tangga kuota ---------------------------------------------------

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    // Safari lama memakai kode 22 tanpa nama yang berguna.
    (err as { code?: number }).code === 22
  );
}

function trimSessions(limit: number): boolean {
  const data = read(STORAGE_KEYS.sessions);
  if (data.items.length <= limit) return false;
  data.items = data.items.slice(-limit);
  rawSet(STORAGE_KEYS.sessions, JSON.stringify(data));
  return true;
}

function trimDaily(days: number): boolean {
  const data = read(STORAGE_KEYS.keystats);
  const keys = Object.keys(data.daily).sort();
  if (keys.length <= days) return false;
  const keep = new Set(keys.slice(-days));
  const next: KeystatsData['daily'] = {};
  for (const k of keep) next[k] = data.daily[k]!;
  data.daily = next;
  rawSet(STORAGE_KEYS.keystats, JSON.stringify(data));
  return true;
}

function dropConfusionsAndBigrams(): boolean {
  const data = read(STORAGE_KEYS.keystats);
  if (Object.keys(data.confusions).length === 0 && Object.keys(data.bigrams).length === 0) {
    return false;
  }
  data.confusions = {};
  data.bigrams = {};
  rawSet(STORAGE_KEYS.keystats, JSON.stringify(data));
  return true;
}

/**
 * Tangga pemangkasan saat kuota penuh (dok. 05 §4, R-21).
 *
 * Urutannya mengikat dan dicoba **berurutan sampai penulisan berhasil**. Yang
 * dikorbankan lebih dulu adalah data yang paling mudah dibangun ulang: riwayat
 * sesi mentah (agregat `daily` tetap menopang grafik), lalu agregat lama, lalu
 * detail diagnosis. Progres kurikulum tidak pernah dikorbankan.
 */
const QUOTA_LADDER: Array<{ level: number; label: string; run: () => boolean }> = [
  {
    level: 1,
    label: `sessions → ${TRIMMED_SESSIONS}`,
    run: () => trimSessions(TRIMMED_SESSIONS),
  },
  {
    level: 2,
    label: `daily → ${TRIMMED_DAILY_DAYS} hari`,
    run: () => trimDaily(TRIMMED_DAILY_DAYS),
  },
  { level: 3, label: 'buang confusions & bigrams', run: dropConfusionsAndBigrams },
];

function recordTrimLevel(level: number): void {
  try {
    const meta = read(STORAGE_KEYS.meta);
    meta.lastQuotaTrimLevel = level;
    rawSet(STORAGE_KEYS.meta, JSON.stringify(meta));
  } catch {
    /* pencatatan debug tidak boleh menggagalkan apa pun */
  }
}

/**
 * Tulis satu key. **Tidak pernah melempar.** Saat kuota penuh, tangga
 * pemangkasan dijalankan; kalau seluruh tangga habis, app beralih ke mode
 * memori dan tetap berjalan.
 */
export function write<K extends StorageKey>(key: K, value: StorageShape[K]): void {
  let payload: string;
  try {
    payload = JSON.stringify(value);
  } catch {
    return; // nilai tidak bisa diserialisasi — bug pemanggil, bukan urusan storage
  }

  try {
    rawSet(key, payload);
    return;
  } catch (err) {
    if (!isQuotaError(err)) return;
  }

  for (const step of QUOTA_LADDER) {
    // Tingkat yang tidak mengubah apa pun dilewati — mencoba menulis ulang
    // setelah pemangkasan nol byte hanya menghabiskan waktu.
    if (!step.run()) continue;
    try {
      rawSet(key, payload);
      recordTrimLevel(step.level);
      return;
    } catch (err) {
      if (!isQuotaError(err)) return;
    }
  }

  // Seluruh tangga habis. Jangan kehilangan sesi yang baru saja selesai —
  // simpan di memori dan biarkan UI memunculkan banner "ekspor progresmu".
  memoryMode = true;
  memory.set(key, payload);
  recordTrimLevel(4);
}

// --- penulisan saat idle (R-20) --------------------------------------------

type IdleHandle = number;
const pending = new Map<StorageKey, unknown>();
let idleHandle: IdleHandle | null = null;

function requestIdle(cb: () => void): IdleHandle {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback;
  return ric ? ric(cb) : (setTimeout(cb, 1) as unknown as number);
}

function cancelIdle(handle: IdleHandle): void {
  const cic = (globalThis as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
  if (cic) cic(handle);
  else clearTimeout(handle);
}

/**
 * Jadwalkan penulisan saat browser senggang (dok. 05 §1 poin 4, R-20).
 *
 * Dipanggil SETELAH layar hasil ter-paint. Menulis ~60 KB JSON secara sinkron
 * tepat saat pengguna baru selesai mengetik adalah biaya nyata di momen yang
 * justru ingin terasa ringan.
 */
export function scheduleWrite<K extends StorageKey>(key: K, value: StorageShape[K]): void {
  pending.set(key, value);
  if (idleHandle !== null) return;
  idleHandle = requestIdle(() => {
    idleHandle = null;
    flushPendingWrites();
  });
}

/** Tulis semua yang tertunda sekarang juga. */
export function flushPendingWrites(): void {
  if (pending.size === 0) return;
  for (const [key, value] of pending) {
    write(key, value as StorageShape[StorageKey]);
  }
  pending.clear();
}

/**
 * Pasang flush paksa saat tab disembunyikan. Tanpa ini, penulisan yang
 * dijadwalkan saat idle bisa tidak pernah kebagian giliran kalau pengguna
 * langsung menutup tab.
 */
export function installFlushOnHide(): () => void {
  const onHide = () => {
    if (document.visibilityState === 'hidden') flushPendingWrites();
  };
  document.addEventListener('visibilitychange', onHide);
  // pagehide menangkap bfcache & penutupan tab di Safari.
  window.addEventListener('pagehide', flushPendingWrites);
  return () => {
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flushPendingWrites);
  };
}

// --- riwayat sesi -----------------------------------------------------------

/** Tambahkan satu hasil sesi, menjaga rolling buffer tetap di MAX_SESSIONS. */
export function appendSession(
  sessions: SessionsData,
  record: SessionsData['items'][number],
): SessionsData {
  const items = [...sessions.items, record];
  return {
    ...sessions,
    items: items.length > MAX_SESSIONS ? items.slice(-MAX_SESSIONS) : items,
  };
}

/** Pangkas keystats ke batas dok. 05 §3 sebelum disimpan. */
export function pruneKeystats(data: KeystatsData): KeystatsData {
  const confusionEntries = Object.entries(data.confusions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CONFUSIONS);

  const dailyKeys = Object.keys(data.daily).sort().slice(-MAX_DAILY_DAYS);

  const daily: KeystatsData['daily'] = {};
  for (const k of dailyKeys) daily[k] = data.daily[k]!;

  return {
    ...data,
    confusions: Object.fromEntries(confusionEntries),
    daily,
  };
}

// --- rekonsiliasi drift kurikulum (R-22) ------------------------------------

export interface ReconciledProgress {
  /** Progres yang lesson-nya masih ada — ini yang dipakai menghitung unlock. */
  active: Record<string, ProgressData['lessons'][string]>;
  /** Id yang tidak dikenal. TETAP DISIMPAN, hanya diabaikan. */
  orphanIds: string[];
}

/**
 * Rekonsiliasi progres terhadap kurikulum yang berubah (dok. 05 §3, R-22).
 *
 * Kurikulum pasti berubah, dan `progress.lessons` bisa memuat id yang sudah
 * tidak ada. Id semacam itu **tidak dihapus** — lesson-nya bisa kembali di
 * versi berikutnya, dan menghapus progres seseorang karena kita mengganti nama
 * id adalah kerugian yang tidak bisa dibatalkan. Ia hanya diabaikan saat
 * menghitung unlock, streak, dan statistik.
 *
 * Menerima daftar id, bukan objek kurikulum, supaya lapisan storage tidak perlu
 * tahu apa pun tentang bentuk kurikulum (dok. 06 §2 aliran satu arah).
 */
export function reconcileProgress(
  progress: ProgressData,
  knownLessonIds: Iterable<string>,
): ReconciledProgress {
  const known = knownLessonIds instanceof Set ? knownLessonIds : new Set(knownLessonIds);
  const active: ReconciledProgress['active'] = {};
  const orphanIds: string[] = [];

  for (const [id, entry] of Object.entries(progress.lessons)) {
    if (known.has(id)) active[id] = entry;
    else orphanIds.push(id);
  }

  return { active, orphanIds };
}

// --- ekspor / impor ---------------------------------------------------------

const EXPORT_APP = 'tendrill';

export function clearAll(): void {
  for (const key of Object.values(STORAGE_KEYS)) rawRemove(key);
  pending.clear();
}

function themeField(): { theme?: 'light' | 'dark' } {
  const theme = readStoredTheme();
  return theme ? { theme } : {};
}

export function exportAll(): string {
  return JSON.stringify({
    app: EXPORT_APP,
    exportedAt: Date.now(),
    schemaVersion: read(STORAGE_KEYS.meta).schemaVersion,
    data: {
      progress: read(STORAGE_KEYS.progress),
      sessions: read(STORAGE_KEYS.sessions),
      keystats: read(STORAGE_KEYS.keystats),
      // Tema aktif hidup di key `tendrill.theme` (dibaca skrip inline sebelum
      // paint), bukan di `typing:settings`. Ia dicerminkan saat ekspor, bukan
      // saat toggle — toggle ada di bundel awal, lapisan storage tidak (ADR-035).
      settings: { ...read(STORAGE_KEYS.settings), ...themeField() },
      meta: read(STORAGE_KEYS.meta),
    },
  });
}

export interface ImportOutcome {
  ok: boolean;
  error?: string;
}

/**
 * Impor berkas ekspor. **Memvalidasi sebelum menulis apa pun** (dok. 05 §6) —
 * impor yang gagal di tengah jalan meninggalkan state campuran yang lebih buruk
 * daripada tidak mengimpor sama sekali.
 */
export function importAll(json: string): ImportOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Berkas bukan JSON yang sah.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'Berkas tidak berisi objek.' };
  }
  const root = parsed as Record<string, unknown>;

  if (root['app'] !== EXPORT_APP) {
    return { ok: false, error: 'Berkas ini bukan ekspor tendrill.' };
  }
  // dok. 05 §6: `schemaVersion` diperiksa sebelum menulis apa pun. Ekspor dari
  // versi app yang lebih baru tidak bisa dibaca dengan jujur oleh versi ini.
  const schemaVersion = root['schemaVersion'];
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion < 1
  ) {
    return { ok: false, error: 'Berkas ekspor tidak menyebut versi skema.' };
  }
  if (schemaVersion > CURRENT_VERSION) {
    return { ok: false, error: 'Berkas ini dibuat versi tendrill yang lebih baru.' };
  }
  if (typeof root['data'] !== 'object' || root['data'] === null) {
    return { ok: false, error: 'Berkas ekspor tidak memuat data.' };
  }

  const data = root['data'] as Record<string, unknown>;
  const staged: Array<[StorageKey, unknown]> = [
    [STORAGE_KEYS.progress, data['progress']],
    [STORAGE_KEYS.sessions, data['sessions']],
    [STORAGE_KEYS.keystats, data['keystats']],
    [STORAGE_KEYS.settings, data['settings']],
    [STORAGE_KEYS.meta, data['meta']],
  ];

  for (const [key, value] of staged) {
    if (value === undefined) continue;
    const migrated =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? migrate(key, value as Record<string, unknown>)
        : { ok: false as const, reason: 'no-path' as const };
    if (!migrated.ok || !VALIDATORS[key](migrated.data)) {
      return { ok: false, error: `Bagian "${key}" tidak sesuai skema.` };
    }
  }

  // Semua lolos — baru sekarang menulis. Tulisan idle yang masih menunggu
  // dibuang dulu: kalau tidak, ia mendarat SESUDAH impor dan menimpanya.
  pending.clear();
  if (idleHandle !== null) {
    cancelIdle(idleHandle);
    idleHandle = null;
  }
  for (const [key, value] of staged) {
    if (value === undefined) continue;
    const migrated = migrate(key, value as Record<string, unknown>);
    if (migrated.ok) write(key, migrated.data as unknown as StorageShape[StorageKey]);
  }

  // Tema aktif hidup di key-nya sendiri (dibaca skrip inline index.html sebelum
  // paint), jadi ia ikut dipulihkan dari `settings.theme` — ADR-035.
  const theme = (data['settings'] as { theme?: unknown } | undefined)?.theme;
  if (theme === 'light' || theme === 'dark') writeTheme(theme);
  return { ok: true };
}

export { STORAGE_KEYS };
export type { StorageKey, StorageShape };
