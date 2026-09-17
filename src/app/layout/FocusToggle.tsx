import { useSettingsStore } from '@/store/settingsStore';

/** Sakelar mode fokus (ADR-045) — kembaran `ThemeToggle`, di sebelahnya. */
export function FocusToggle() {
  const focusMode = useSettingsStore((s) => s.focusMode);
  const toggleFocusMode = useSettingsStore((s) => s.toggleFocusMode);

  return (
    <button
      type="button"
      onClick={(event) => {
        // Blur: tanpa itu spasi pertama di sesi menekan sakelar lagi (lihat InputModeToggle).
        event.currentTarget.blur();
        toggleFocusMode();
      }}
      aria-pressed={focusMode}
      title="Mode fokus: menu dan petunjuk memudar selama mengetik"
      className="rounded border border-line bg-surface px-3 py-1 font-mono text-[11px] font-medium tracking-[0.16em] text-fg-dim uppercase hover:text-fg"
    >
      fokus {focusMode ? 'nyala' : 'mati'}
    </button>
  );
}
