import { useCallback } from 'react';
import './input-mode-toggle.css';

/**
 * Sakelar siluet tangan di `/practice` (ADR-036).
 *
 * Kembaran `InputModeToggle` dengan sengaja — satu bahasa visual di bawah
 * keyboard, dan detail yang sama: **blur setelah ditekan**, supaya spasi
 * berikutnya masuk ke latihan, bukan menekan sakelar lagi.
 * Yang menyimpan pilihan adalah pemanggil.
 */

export interface HandsToggleProps {
  shown: boolean;
  onChange: (next: boolean) => void;
}

export function HandsToggle({ shown, onChange }: HandsToggleProps) {
  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.currentTarget.blur();
      onChange(!shown);
    },
    [shown, onChange],
  );

  return (
    <button
      type="button"
      className="imt-root"
      onClick={toggle}
      aria-pressed={shown}
      aria-label={`Siluet tangan ${shown ? 'tampil' : 'tersembunyi'}. Klik untuk mengganti.`}
      title="Siluet tangan di atas keyboard"
    >
      <span className="imt-label">tangan</span>
      <span className="imt-value">{shown ? 'tampil' : 'sembunyi'}</span>
    </button>
  );
}
