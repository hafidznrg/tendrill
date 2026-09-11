import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetForTests,
  appendSession,
  clearAll,
  exportAll,
  flushPendingWrites,
  importAll,
  isMemoryMode,
  pruneKeystats,
  read,
  reconcileProgress,
  scheduleWrite,
  STORAGE_KEYS,
  write,
} from '../index.ts';
import { defaultSessions, MAX_SESSIONS, type SessionRecord } from '../schema.ts';

function makeRecord(i: number): SessionRecord {
  return {
    id: `s${i}`,
    at: 1_700_000_000_000 + i,
    source: 'lesson',
    lessonId: 'u1-l1',
    durationMs: 60_000,
    netWpm: 30 + i,
    grossWpm: 32 + i,
    accuracy: 95,
    consistency: 0.8,
    totalKeystrokes: 300,
    correctKeystrokes: 285,
  };
}

/** Paksa localStorage melempar QuotaExceededError pada N penulisan pertama. */
function throwQuotaTimes(times: number): () => void {
  let remaining = times;
  const original = Storage.prototype.setItem;
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string,
  ) {
    if (remaining > 0) {
      remaining -= 1;
      const err = new Error('penuh');
      err.name = 'QuotaExceededError';
      throw err;
    }
    return original.call(this, key, value);
  });
  return () => spy.mockRestore();
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('baca defensif (dok. 09 §3)', () => {
  it('key yang belum ada → fallback', () => {
    expect(read(STORAGE_KEYS.sessions)).toEqual(defaultSessions());
    expect(read(STORAGE_KEYS.progress).lessons).toEqual({});
  });

  it('JSON rusak → fallback, tidak throw', () => {
    localStorage.setItem(STORAGE_KEYS.sessions, '{bukan json');
    expect(() => read(STORAGE_KEYS.sessions)).not.toThrow();
    expect(read(STORAGE_KEYS.sessions).items).toEqual([]);
  });

  it('bentuk data salah → fallback', () => {
    localStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify({ version: 1, items: 'bukan array' }),
    );
    expect(read(STORAGE_KEYS.sessions).items).toEqual([]);

    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ version: 1, theme: 'ungu' }));
    expect(read(STORAGE_KEYS.settings).theme).toBe('system');
  });

  it('data versi lebih baru → fallback, dan data lama TIDAK ditimpa', () => {
    const fromFuture = JSON.stringify({ version: 99, items: [makeRecord(1)] });
    localStorage.setItem(STORAGE_KEYS.sessions, fromFuture);

    expect(read(STORAGE_KEYS.sessions).items).toEqual([]);
    // Inilah yang penting: membaca tidak boleh menghancurkan data pengguna.
    expect(localStorage.getItem(STORAGE_KEYS.sessions)).toBe(fromFuture);
  });

  it('data versi lama tanpa jalur migrasi → fallback', () => {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify({ version: 0, items: [] }));
    expect(read(STORAGE_KEYS.sessions)).toEqual(defaultSessions());
  });
});

describe('tulis & kuota (dok. 09 §3, R-21)', () => {
  it('round-trip tulis lalu baca', () => {
    const data = appendSession(defaultSessions(), makeRecord(1));
    write(STORAGE_KEYS.sessions, data);
    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(1);
  });

  it('rolling buffer terpotong tepat di 200', () => {
    let data = defaultSessions();
    for (let i = 0; i < MAX_SESSIONS + 37; i++) data = appendSession(data, makeRecord(i));

    expect(data.items).toHaveLength(MAX_SESSIONS);
    // Yang dibuang adalah yang tertua.
    expect(data.items[0]!.id).toBe('s37');
    expect(data.items.at(-1)!.id).toBe(`s${MAX_SESSIONS + 36}`);
  });

  it('QuotaExceededError ditangani tanpa crash', () => {
    const restore = throwQuotaTimes(99);
    expect(() => write(STORAGE_KEYS.sessions, defaultSessions())).not.toThrow();
    restore();
  });

  it('tangga pemangkasan berjalan berurutan dan berhenti di tingkat yang berhasil', () => {
    // Isi sessions melebihi batas pemangkasan tingkat 1.
    let sessions = defaultSessions();
    for (let i = 0; i < MAX_SESSIONS; i++) sessions = appendSession(sessions, makeRecord(i));
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));

    // Penulisan pertama gagal; percobaan setelah pemangkasan tingkat 1 berhasil.
    const restore = throwQuotaTimes(1);
    write(STORAGE_KEYS.keystats, read(STORAGE_KEYS.keystats));
    restore();

    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(100);
    expect(read(STORAGE_KEYS.meta).lastQuotaTrimLevel).toBe(1);
  });

  it('seluruh tangga habis → mode memori, app tetap jalan', () => {
    const restore = throwQuotaTimes(99);
    let sessions = defaultSessions();
    for (let i = 0; i < MAX_SESSIONS; i++) sessions = appendSession(sessions, makeRecord(i));

    write(STORAGE_KEYS.sessions, sessions);

    expect(isMemoryMode()).toBe(true);
    // Data yang baru ditulis tetap terbaca — hanya tidak persisten.
    expect(read(STORAGE_KEYS.sessions).items.length).toBeGreaterThan(0);
    restore();
  });
});

describe('mode memori (dok. 09 §3)', () => {
  it('localStorage tidak tersedia → app tetap jalan', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('diblokir');
    });
    _resetForTests();

    expect(isMemoryMode()).toBe(true);
    expect(() => write(STORAGE_KEYS.settings, read(STORAGE_KEYS.settings))).not.toThrow();
    expect(read(STORAGE_KEYS.settings).theme).toBe('system');

    spy.mockRestore();
  });
});

describe('penulisan saat idle (dok. 09 §3, R-20)', () => {
  it('scheduleWrite tidak menulis seketika, flush menulisnya', () => {
    vi.useFakeTimers();
    const data = appendSession(defaultSessions(), makeRecord(1));

    scheduleWrite(STORAGE_KEYS.sessions, data);
    expect(localStorage.getItem(STORAGE_KEYS.sessions)).toBeNull();

    flushPendingWrites();
    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(1);
  });

  it('penulisan yang tertunda ter-flush, bukan hilang', () => {
    vi.useFakeTimers();
    scheduleWrite(STORAGE_KEYS.sessions, appendSession(defaultSessions(), makeRecord(2)));
    vi.runAllTimers();
    expect(read(STORAGE_KEYS.sessions).items[0]!.id).toBe('s2');
  });
});

describe('pemangkasan keystats (dok. 05 §3)', () => {
  it('confusions dipangkas ke 50 teratas dan daily ke 365 hari', () => {
    const data = read(STORAGE_KEYS.keystats);
    for (let i = 0; i < 80; i++) data.confusions[`a>${i}`] = i;
    for (let i = 0; i < 400; i++) {
      const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
      data.daily[d] = { sessions: 1, ms: 1000, avgWpm: 30, avgAccuracy: 95 };
    }

    const pruned = pruneKeystats(data);
    expect(Object.keys(pruned.confusions)).toHaveLength(50);
    expect(Object.keys(pruned.daily)).toHaveLength(365);
    // Yang tersisa adalah yang terbesar dan yang terbaru.
    expect(pruned.confusions['a>79']).toBe(79);
    expect(pruned.confusions['a>1']).toBeUndefined();
    expect(Object.keys(pruned.daily).sort()[0]).toBe('2024-02-05');
  });
});

describe('reconcileProgress (dok. 09 §3, R-22)', () => {
  const progress = {
    version: 1,
    lessons: {
      'u1-l1': {
        status: 'passed' as const,
        attempts: 2,
        bestWpm: 30,
        bestAccuracy: 96,
        firstPassedAt: 1,
        lastAttemptAt: 2,
      },
      'u9-l9': {
        status: 'passed' as const,
        attempts: 1,
        bestWpm: 40,
        bestAccuracy: 99,
        firstPassedAt: 1,
        lastAttemptAt: 2,
      },
    },
    placement: null,
  };

  it('mengabaikan lessonId yang sudah tidak ada TANPA menghapusnya', () => {
    const { active, orphanIds } = reconcileProgress(progress, ['u1-l1', 'u1-l2']);

    expect(Object.keys(active)).toEqual(['u1-l1']);
    expect(orphanIds).toEqual(['u9-l9']);
    // Data aslinya tidak disentuh — lesson-nya bisa kembali di versi berikutnya.
    expect(progress.lessons['u9-l9']).toBeDefined();
  });

  it('progres kosong → tidak ada yang aktif, tidak crash', () => {
    const { active, orphanIds } = reconcileProgress(
      { version: 1, lessons: {}, placement: null },
      ['u1-l1'],
    );
    expect(active).toEqual({});
    expect(orphanIds).toEqual([]);
  });
});

describe('ekspor & impor (dok. 09 §3)', () => {
  it('ekspor lalu impor menghasilkan state identik', () => {
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), makeRecord(7)));
    const settings = read(STORAGE_KEYS.settings);
    settings.theme = 'dark';
    settings.soundEnabled = true;
    write(STORAGE_KEYS.settings, settings);

    const dump = exportAll();
    const before = {
      sessions: read(STORAGE_KEYS.sessions),
      settings: read(STORAGE_KEYS.settings),
      progress: read(STORAGE_KEYS.progress),
      keystats: read(STORAGE_KEYS.keystats),
    };

    clearAll();
    expect(read(STORAGE_KEYS.sessions).items).toEqual([]);

    expect(importAll(dump)).toEqual({ ok: true });
    expect({
      sessions: read(STORAGE_KEYS.sessions),
      settings: read(STORAGE_KEYS.settings),
      progress: read(STORAGE_KEYS.progress),
      keystats: read(STORAGE_KEYS.keystats),
    }).toEqual(before);
  });

  it('menolak berkas yang bukan ekspor tendrill, tanpa menyentuh data', () => {
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), makeRecord(1)));

    const out = importAll(JSON.stringify({ app: 'aplikasi-lain', data: {} }));
    expect(out.ok).toBe(false);
    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(1);
  });

  it('menolak JSON rusak', () => {
    expect(importAll('{bukan json').ok).toBe(false);
  });

  it('memvalidasi SEBELUM menulis apa pun — impor gagal tidak meninggalkan state campuran', () => {
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), makeRecord(1)));
    const settingsBefore = read(STORAGE_KEYS.settings);

    const rusak = JSON.stringify({
      app: 'tendrill',
      exportedAt: Date.now(),
      schemaVersion: 1,
      data: {
        // settings sah, sessions rusak: tidak boleh ada satu pun yang tertulis
        settings: { ...settingsBefore, theme: 'dark' },
        sessions: { version: 1, items: 'bukan array' },
      },
    });

    expect(importAll(rusak).ok).toBe(false);
    expect(read(STORAGE_KEYS.settings).theme).toBe(settingsBefore.theme);
    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(1);
  });
});
