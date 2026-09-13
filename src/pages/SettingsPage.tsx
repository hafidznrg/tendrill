import { useRef, useState, type ChangeEvent } from 'react';
import { clearAll, exportAll, importAll, read, write, STORAGE_KEYS } from '@/lib/storage';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * `/settings` (dok. 02 §7, dok. 05 §6–§7) — Fase 8.
 *
 * Aturan yang mengikat halaman ini:
 * - Impor **divalidasi dulu, lalu dikonfirmasi**, baru menimpa (dok. 05 §6).
 *   Validasi & penulisan ada di `importAll`; halaman ini hanya menahan teks
 *   berkasnya sampai pengguna menekan "Timpa".
 * - Hapus data butuh mengetik `DELETE` (dok. 02 §7).
 * - Pernyataan privasi ditulis eksplisit (dok. 05 §7).
 */

const H2 = 'font-mono text-[13px] font-bold tracking-[0.12em] uppercase text-fg-dim';
const BTN = 'rounded border border-line px-3 py-1.5 font-mono text-[13px] hover:border-accent';
const BTN_PRIMARY = 'rounded bg-accent px-3 py-1.5 font-mono text-[13px] font-bold text-bg';

function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `typing-progress-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export default function SettingsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const [sound, setSound] = useState(() => read(STORAGE_KEYS.settings).soundEnabled);
  const [pendingImport, setPendingImport] = useState<{ name: string; text: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmText, setConfirmText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleSound = () => {
    const next = !sound;
    write(STORAGE_KEYS.settings, { ...read(STORAGE_KEYS.settings), soundEnabled: next });
    setSound(next);
  };

  const onExport = () => {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(new Date());
    a.click();
    URL.revokeObjectURL(url);
    setNotice({ kind: 'ok', text: `Progres diekspor ke ${a.download}.` });
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNotice(null);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('gagal membaca berkas'));
      reader.readAsText(file);
    }).catch(() => null);
    if (text === null) {
      setNotice({ kind: 'error', text: 'Berkas tidak bisa dibaca.' });
      return;
    }
    setPendingImport({ name: file.name, text });
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const outcome = importAll(pendingImport.text);
    setPendingImport(null);
    if (!outcome.ok) {
      setNotice({ kind: 'error', text: outcome.error ?? 'Impor gagal.' });
      return;
    }
    const imported = read(STORAGE_KEYS.settings);
    setSound(imported.soundEnabled);
    if (imported.theme === 'light' || imported.theme === 'dark') setTheme(imported.theme);
    setNotice({ kind: 'ok', text: 'Progres dipulihkan.' });
  };

  const onDeleteAll = () => {
    clearAll();
    setConfirmText('');
    setSound(read(STORAGE_KEYS.settings).soundEnabled);
    setNotice({ kind: 'ok', text: 'Semua data dihapus.' });
  };

  return (
    <section className="space-y-10">
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">Pengaturan</h1>

      <div className="space-y-3">
        <h2 className={H2}>Tampilan & suara</h2>
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Tema</legend>
          <span className="w-32 text-fg-dim">Tema</span>
          {(['light', 'dark'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="theme"
                checked={theme === t}
                onChange={() => setTheme(t)}
              />
              {t === 'light' ? 'terang' : 'gelap'}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-3">
          <span className="w-32 text-fg-dim">Suara ketik</span>
          <input type="checkbox" checked={sound} onChange={toggleSound} />
          <span>{sound ? 'nyala' : 'mati'}</span>
        </label>
      </div>

      <div className="space-y-3">
        <h2 className={H2}>Data</h2>
        <p className="text-fg-dim">
          Semua progresmu hanya tersimpan di browser ini. Tidak ada data yang meninggalkan
          perangkat — tidak ada akun, tidak ada analytics, tidak ada request ke server mana pun.
          Membersihkan data browser akan menghapusnya, jadi ekspor sesekali.
        </p>

        <div className="flex flex-wrap gap-3">
          <button type="button" className={BTN} onClick={onExport}>
            Ekspor progres
          </button>
          <button type="button" className={BTN} onClick={() => fileRef.current?.click()}>
            Impor progres
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file"
            onChange={(e) => void onPickFile(e)}
          />
        </div>

        {pendingImport && (
          <div role="alertdialog" className="rounded border border-line bg-surface p-4">
            <p>
              Impor <b>{pendingImport.name}</b> akan <b>menimpa</b> seluruh progres di browser
              ini.
            </p>
            <div className="mt-3 flex gap-3">
              <button type="button" className={BTN_PRIMARY} onClick={confirmImport}>
                Timpa
              </button>
              <button type="button" className={BTN} onClick={() => setPendingImport(null)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {notice && (
          <p role="status" className={notice.kind === 'error' ? 'text-error' : 'text-accent'}>
            {notice.text}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className={H2}>Hapus semua data</h2>
        <p className="text-fg-dim">
          Tidak bisa dibatalkan. Ketik <code className="font-mono">DELETE</code> untuk
          memastikan.
        </p>
        <div className="flex gap-3">
          <input
            aria-label="Ketik DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="rounded border border-line bg-bg px-2 py-1 font-mono"
          />
          <button
            type="button"
            className={BTN}
            disabled={confirmText !== 'DELETE'}
            onClick={onDeleteAll}
          >
            Hapus semua data
          </button>
        </div>
      </div>
    </section>
  );
}
