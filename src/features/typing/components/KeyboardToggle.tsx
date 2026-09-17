import { useCallback } from 'react';
import './input-mode-toggle.css';

/**
 * Sakelar tampil/sembunyi virtual keyboard (ADR-045). Kembaran `HandsToggle`:
 * bahasa visual yang sama, dan **blur setelah ditekan** supaya spasi berikutnya
 * masuk ke latihan. Yang menyimpan pilihan adalah pemanggil.
 */

export interface KeyboardToggleProps {
  shown: boolean;
  onChange: (next: boolean) => void;
}

export function KeyboardToggle({ shown, onChange }: KeyboardToggleProps) {
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
      aria-label={`Keyboard ${shown ? 'tampil' : 'tersembunyi'}. Klik untuk mengganti.`}
      title="Virtual keyboard di bawah teks"
    >
      <span className="imt-label">keyboard</span>
      <span className="imt-value">{shown ? 'tampil' : 'sembunyi'}</span>
    </button>
  );
}
