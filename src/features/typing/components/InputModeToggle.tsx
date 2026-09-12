import { useCallback } from 'react';
import type { InputMode } from '@/lib/storage/schema.ts';
import './input-mode-toggle.css';

/**
 * Sakelar mode input di layar sesi (ADR-029).
 *
 * Aturan yang membentuk komponen ini, semuanya dari ADR-029:
 *
 * - **Mode yang aktif terlihat tanpa membuka pengaturan.** Pengguna yang
 *   tertahan harus langsung paham KENAPA ia tertahan; kalau tidak, itu terbaca
 *   sebagai aplikasi rusak.
 * - Satu klik untuk berganti, dan pilihannya bertahan ke lesson berikutnya
 *   (yang menyimpan adalah pemanggil).
 *
 * Dua detail kecil yang gampang terlewat dan keduanya disengaja:
 * 1. **Blur setelah ditekan.** Tanpa itu tombolnya tetap fokus, dan spasi
 *    berikutnya yang diketik pengguna akan menekannya lagi alih-alih masuk ke
 *    drill.
 * 2. Lebar teksnya **dipesan** lewat `min-width`, jadi berganti mode tidak
 *    menggeser apa pun di sekitarnya.
 */

export interface InputModeToggleProps {
  mode: InputMode;
  onChange: (next: InputMode) => void;
}

const LABEL: Record<InputMode, string> = {
  strict: 'strict',
  'non-strict': 'bebas',
};

const EXPLANATION: Record<InputMode, string> = {
  strict: 'Tombol salah menahan kursor sampai kamu menekan yang benar.',
  'non-strict': 'Tombol salah ditandai, tapi kursor tetap maju.',
};

export function InputModeToggle({ mode, onChange }: InputModeToggleProps) {
  const toggle = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.currentTarget.blur();
      onChange(mode === 'strict' ? 'non-strict' : 'strict');
    },
    [mode, onChange],
  );

  return (
    <button
      type="button"
      className="imt-root"
      onClick={toggle}
      aria-label={`Mode ${LABEL[mode]}. ${EXPLANATION[mode]} Klik untuk mengganti.`}
      title={EXPLANATION[mode]}
    >
      <span className="imt-label">mode</span>
      <span className={`imt-value${mode === 'strict' ? ' imt-value-strict' : ''}`}>
        {LABEL[mode]}
      </span>
    </button>
  );
}
