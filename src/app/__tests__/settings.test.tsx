import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import SettingsPage from '@/pages/SettingsPage';
import {
  _resetForTests,
  appendSession,
  exportAll,
  read,
  STORAGE_KEYS,
  write,
} from '@/lib/storage';
import { defaultSessions } from '@/lib/storage/schema.ts';
import { useSettingsStore } from '@/store/settingsStore';

const record = (id: string) => ({
  id,
  at: 1_700_000_000_000,
  source: 'practice' as const,
  mode: '30s' as const,
  durationMs: 30_000,
  netWpm: 42,
  grossWpm: 44,
  accuracy: 97,
  consistency: 0.8,
  totalKeystrokes: 120,
  correctKeystrokes: 117,
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

async function pickFile(text: string) {
  const input = screen.getByTestId('import-file') as HTMLInputElement;
  const file = new File([text], 'typing-progress.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
  return screen.findByRole('alertdialog');
}

beforeEach(() => {
  localStorage.clear();
  _resetForTests();
  useSettingsStore.getState().setTheme('light');
});
afterEach(() => vi.restoreAllMocks());

describe('/settings (Fase 8)', () => {
  it('suara ketik tersimpan ke typing:settings, default mati', async () => {
    renderPage();
    const box = screen.getByRole('checkbox', { name: /suara ketik/i });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(read(STORAGE_KEYS.settings).soundEnabled).toBe(true);
  });

  it('impor meminta konfirmasi dulu — "Batal" tidak menulis apa pun', async () => {
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), record('lama')));
    const dump = exportAll();
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), record('baru')));

    renderPage();
    await pickFile(dump);
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(read(STORAGE_KEYS.sessions).items.map((s) => s.id)).toEqual(['baru']);

    await pickFile(dump);
    await userEvent.click(screen.getByRole('button', { name: 'Timpa' }));
    expect(read(STORAGE_KEYS.sessions).items.map((s) => s.id)).toEqual(['lama']);
    expect(screen.getByRole('status')).toHaveTextContent('Progres dipulihkan.');
  });

  it('impor berkas asing menampilkan error dan tidak menyentuh data', async () => {
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), record('tetap')));
    renderPage();
    await pickFile(JSON.stringify({ app: 'lain' }));
    await userEvent.click(screen.getByRole('button', { name: 'Timpa' }));
    expect(screen.getByRole('status')).toHaveTextContent('bukan ekspor tendrill');
    expect(read(STORAGE_KEYS.sessions).items).toHaveLength(1);
  });

  it('impor memulihkan tema yang diekspor', async () => {
    useSettingsStore.getState().setTheme('dark');
    const dump = exportAll();
    useSettingsStore.getState().setTheme('light');

    renderPage();
    await pickFile(dump);
    await userEvent.click(screen.getByRole('button', { name: 'Timpa' }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('ekspor mengunduh berkas typing-progress-YYYY-MM-DD.json', async () => {
    const create = vi.fn(() => 'blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Ekspor progres' }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toMatch(
      /typing-progress-\d{4}-\d{2}-\d{2}\.json/,
    );
  });

  it('hapus semua data baru aktif setelah mengetik DELETE', async () => {
    write(STORAGE_KEYS.sessions, appendSession(defaultSessions(), record('x')));
    renderPage();
    const btn = screen.getByRole('button', { name: 'Hapus semua data' });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Ketik DELETE'), 'delete');
    expect(btn).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Ketik DELETE'));
    await userEvent.type(screen.getByLabelText('Ketik DELETE'), 'DELETE');
    await userEvent.click(btn);
    expect(read(STORAGE_KEYS.sessions).items).toEqual([]);
  });

  it('menyatakan privasi secara eksplisit (dok. 05 §7)', () => {
    renderPage();
    expect(screen.getByText(/tidak ada data yang meninggalkan perangkat/i)).toBeInTheDocument();
  });
});
