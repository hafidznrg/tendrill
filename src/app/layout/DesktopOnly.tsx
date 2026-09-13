import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Halaman penolakan mobile (dok. 02 §8, ADR-005) — ADR-035.
 *
 * Hanya membungkus rute yang butuh keyboard fisik. `/stats` tetap terbuka.
 *
 * Diputuskan **sekali saat rute dipasang**, tidak mendengarkan `resize`:
 * ADR-028 menjanjikan jendela desktop yang dipersempit membungkus ulang teks
 * TANPA menghapus ketikan. Gerbang yang ikut bereaksi pada resize akan melepas
 * layar sesi di tengah jalan begitu lebar melewati 899 px.
 */
export const NARROW_QUERY = '(max-width: 899px), (hover: none) and (pointer: coarse)';

function isNarrow(): boolean {
  return typeof matchMedia === 'function' && matchMedia(NARROW_QUERY).matches;
}

export function DesktopOnly({ children }: { children: ReactNode }) {
  const [narrow] = useState(isNarrow);
  if (!narrow) return children;
  return (
    <section className="rounded border border-line bg-surface p-6">
      <h1 className="font-mono text-[19px] font-bold tracking-[-0.02em]">
        Latihan 10 jari butuh keyboard fisik.
      </h1>
      <p className="mt-2 text-fg-dim">Buka halaman ini di laptop atau komputer.</p>
      <p className="mt-4 text-fg-dim">
        Statistikmu tetap bisa dibaca di sini:{' '}
        <Link to="/stats" className="text-accent underline">
          buka statistik
        </Link>
        .
      </p>
    </section>
  );
}
