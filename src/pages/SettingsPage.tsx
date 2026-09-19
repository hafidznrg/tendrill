import { useRef, useState, type ChangeEvent } from 'react';
import { clearAll, exportAll, importAll, read, write, STORAGE_KEYS } from '@/lib/storage';
import {
  readShowHandsInPractice,
  readShowKeyboard,
  writeShowHandsInPractice,
  writeShowKeyboard,
} from '@/lib/storage/flags.ts';
import { readFocusMode } from '@/lib/storage/focus.ts';
import { useSettingsStore } from '@/store/settingsStore';
import { MoonIcon, SunIcon } from '@/app/layout/themeIcons';
import './settings-page.css';

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

function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `typing-progress-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

export default function SettingsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const focus = useSettingsStore((s) => s.focusMode);
  const setFocusMode = useSettingsStore((s) => s.setFocusMode);

  const [sound, setSound] = useState(() => read(STORAGE_KEYS.settings).soundEnabled);
  const [hands, setHands] = useState(readShowHandsInPractice);
  const [keyboard, setKeyboard] = useState(readShowKeyboard);
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

  const toggleHands = () => {
    const next = !hands;
    writeShowHandsInPractice(next);
    setHands(next);
  };

  const toggleKeyboard = () => {
    const next = !keyboard;
    writeShowKeyboard(next);
    setKeyboard(next);
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
    setHands(readShowHandsInPractice());
    setKeyboard(readShowKeyboard());
    setFocusMode(readFocusMode());
    if (imported.theme === 'light' || imported.theme === 'dark') setTheme(imported.theme);
    setNotice({ kind: 'ok', text: 'Progres dipulihkan.' });
  };

  const onDeleteAll = () => {
    clearAll();
    setConfirmText('');
    setSound(read(STORAGE_KEYS.settings).soundEnabled);
    setHands(readShowHandsInPractice());
    setKeyboard(readShowKeyboard());
    setFocusMode(readFocusMode());
    setNotice({ kind: 'ok', text: 'Semua data dihapus.' });
  };

  return (
    <section className="st-root">
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">Pengaturan</h1>

      <div className="st-group">
        <h2 className="st-label">Tampilan</h2>
        <div className="st-rows">
          <div className="st-row">
            <div>
              <div className="st-title" id="theme-label">
                Tema
              </div>
              <p className="st-desc">Warna seluruh aplikasi.</p>
            </div>
            <fieldset aria-labelledby="theme-label" className="st-seg">
              {(['light', 'dark'] as const).map((t) => (
                <label key={t} title={t === 'light' ? 'Terang' : 'Gelap'}>
                  <input
                    type="radio"
                    name="theme"
                    checked={theme === t}
                    onChange={() => setTheme(t)}
                  />
                  {t === 'light' ? <SunIcon /> : <MoonIcon />}
                  <span className="sr-only">{t === 'light' ? 'terang' : 'gelap'}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </div>
      </div>

      <div className="st-group">
        <h2 className="st-label">Layar mengetik</h2>
        <div className="st-rows">
          <SwitchRow
            title="Keyboard di layar"
            desc="Kalau disembunyikan, siluet tangan ikut hilang."
            checked={keyboard}
            onChange={toggleKeyboard}
          />
          <SwitchRow
            title="Siluet tangan di latihan bebas"
            desc="Di lesson kurikulum siluet selalu tampil."
            checked={hands}
            onChange={toggleHands}
          />
          <SwitchRow
            title="Mode fokus"
            desc="Menu dan petunjuk memudar selama kamu mengetik."
            checked={focus}
            onChange={() => setFocusMode(!focus)}
          />
          <SwitchRow
            title="Suara ketik"
            desc="Bunyi pelan tiap tombol ditekan."
            checked={sound}
            onChange={toggleSound}
          />
        </div>
      </div>

      <div className="st-group">
        <h2 className="st-label">Data</h2>
        <div className="st-rows">
          <div className="st-row">
            <div>
              <div className="st-title">Cadangkan progres</div>
              <p className="st-desc">
                Semua progresmu hanya tersimpan di browser ini. Tidak ada data yang meninggalkan
                perangkat — tidak ada akun, tidak ada analytics, tidak ada request ke server
                mana pun. Membersihkan data browser akan menghapusnya, jadi ekspor sesekali.
              </p>
            </div>
            <div className="st-actions">
              <button type="button" className="st-btn" onClick={onExport}>
                Ekspor progres
              </button>
              <button type="button" className="st-btn" onClick={() => fileRef.current?.click()}>
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
          </div>

          {pendingImport && (
            <div role="alertdialog" className="st-confirm">
              <p>
                Impor <b>{pendingImport.name}</b> akan <b>menimpa</b> seluruh progres di browser
                ini.
              </p>
              <div
                className="st-actions"
                style={{ justifyContent: 'flex-start', marginTop: 12 }}
              >
                <button type="button" className="st-btn" data-primary onClick={confirmImport}>
                  Timpa
                </button>
                <button type="button" className="st-btn" onClick={() => setPendingImport(null)}>
                  Batal
                </button>
              </div>
            </div>
          )}

          {notice && (
            <p
              role="status"
              className="st-notice"
              data-error={notice.kind === 'error' || undefined}
            >
              {notice.text}
            </p>
          )}
        </div>
      </div>

      <div className="st-group">
        <h2 className="st-label" data-danger>
          Zona bahaya
        </h2>
        <div className="st-rows" data-danger>
          <div className="st-row">
            <div>
              <div className="st-title">Hapus semua data</div>
              <p className="st-desc">
                Tidak bisa dibatalkan. Ketik <code>DELETE</code> untuk membuka tombolnya.
              </p>
            </div>
            <div className="st-actions">
              <input
                aria-label="Ketik DELETE"
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="st-input"
              />
              <button
                type="button"
                className="st-btn"
                data-danger
                disabled={confirmText !== 'DELETE'}
                onClick={onDeleteAll}
              >
                Hapus semua data
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Satu baris nyala/mati: checkbox asli ber-`role="switch"`, digambar ulang di `settings-page.css`. */
function SwitchRow(props: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="st-row">
      <div>
        <div className="st-title">{props.title}</div>
        <p className="st-desc">{props.desc}</p>
      </div>
      <input
        type="checkbox"
        role="switch"
        className="st-switch"
        checked={props.checked}
        onChange={props.onChange}
      />
    </label>
  );
}
