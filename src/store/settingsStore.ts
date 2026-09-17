import { create } from 'zustand';
import { readTheme, writeTheme, type Theme } from '@/lib/storage/theme';
import { readFocusMode, writeFocusMode } from '@/lib/storage/focus';

interface SettingsState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Mode fokus (ADR-045). CSS memudarkan hanya kalau `data-session="running"` juga ada. */
  focusMode: boolean;
  setFocusMode: (on: boolean) => void;
  toggleFocusMode: () => void;
}

function apply(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
}

function applyFocus(on: boolean): void {
  if (on) document.documentElement.dataset['focusMode'] = 'on';
  else delete document.documentElement.dataset['focusMode'];
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    apply(theme);
    writeTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  focusMode: readFocusMode(),
  setFocusMode: (on) => {
    applyFocus(on);
    writeFocusMode(on);
    set({ focusMode: on });
  },
  toggleFocusMode: () => get().setFocusMode(!get().focusMode),
}));

// Sinkronkan atribut DOM dengan state awal (skrip di index.html sudah
// menetapkannya sebelum paint; ini menjaga keduanya tidak pernah berbeda).
apply(useSettingsStore.getState().theme);
applyFocus(useSettingsStore.getState().focusMode);
