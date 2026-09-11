import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../layout/ThemeToggle';
import { useSettingsStore } from '@/store/settingsStore';

describe('toggle tema (dok. 08 Fase 0 DoD)', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.getState().setTheme('light');
  });

  it('mengganti data-theme dan menyimpannya', async () => {
    render(<ThemeToggle />);
    expect(document.documentElement.dataset['theme']).toBe('light');

    await userEvent.click(screen.getByRole('button'));

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('tendrill.theme')).toBe('dark');
  });
});
