import { useSettingsStore } from '@/store/settingsStore';

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={theme === 'dark'}
      className="rounded border border-line bg-surface px-3 py-1 font-mono text-[11px] font-medium tracking-[0.16em] text-fg-dim uppercase hover:text-fg"
    >
      {theme === 'dark' ? 'gelap' : 'terang'}
    </button>
  );
}
