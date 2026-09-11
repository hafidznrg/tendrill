import { create } from 'zustand';
import { readTheme, writeTheme, type Theme } from '@/lib/storage/theme';

interface SettingsState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function apply(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    apply(theme);
    writeTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

// Sinkronkan atribut DOM dengan state awal (skrip di index.html sudah
// menetapkannya sebelum paint; ini menjaga keduanya tidak pernah berbeda).
apply(useSettingsStore.getState().theme);
