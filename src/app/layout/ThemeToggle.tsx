import { useSettingsStore } from '@/store/settingsStore';
import { MoonIcon, SunIcon } from './themeIcons';

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label="Mode gelap"
      title={dark ? 'Tema gelap — klik untuk terang' : 'Tema terang — klik untuk gelap'}
      className="grid size-8 place-items-center rounded border border-line bg-surface text-fg-dim hover:text-fg"
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
