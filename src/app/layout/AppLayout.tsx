import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { RouteErrorBoundary } from './ErrorBoundary';
import { ThemeToggle } from './ThemeToggle';
import markUrl from '@/assets/brand/mark.svg';
import { prefetchSessionPath } from '../prefetch.ts';

const NAV = [
  { to: '/learn', label: 'belajar' },
  { to: '/practice', label: 'latihan' },
  { to: '/stats', label: 'statistik' },
  { to: '/settings', label: 'pengaturan' },
] as const;

/**
 * Rute yang butuh lebar lebih dari `max-w-3xl`: `/posture` (ADR-038 poin 12 — panduan +
 * keyboard di kiri, peta jari di kanan) dan beranda `/` (ADR-039 — hero dua kolom,
 * isinya sendiri dibatasi 1040 px). Halaman lain sengaja tetap sempit — layar sesi
 * mengukur lebar teksnya sendiri (ADR-028) dan tidak boleh ikut melebar.
 */
const WIDE_ROUTES = new Set(['/', '/posture']);

/**
 * Rute sesi memakai padding vertikal lebih kecil (ADR-041): panggungnya paling
 * tinggi di aplikasi ini (teks + keyboard + siluet), dan 32 px yang dihemat di
 * sini dipakai menaikkan area teks ke posisi baca yang nyaman di layar 900 px.
 */
function isSessionRoute(pathname: string): boolean {
  return (
    pathname === '/placement' ||
    pathname === '/practice' ||
    pathname === '/practice/adaptive' ||
    pathname.startsWith('/learn/')
  );
}

export function AppLayout() {
  // Jalur sesi disiapkan di latar sejak halaman mana pun dibuka (dok. 06 §6).
  useEffect(prefetchSessionPath, []);
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex items-center gap-6 border-b border-line px-6 py-3">
        <NavLink to="/" className="flex items-center gap-2">
          {/* dok. 12 §3: mark 34px + wordmark 26px di bilah atas. */}
          <img src={markUrl} alt="" width={34} height={34} />
          <span className="font-mono text-[26px] font-extrabold tracking-[-0.045em] lowercase">
            ten<u className="decoration-accent decoration-[0.11em] underline-offset-4">d</u>ri
            <u className="decoration-accent decoration-[0.11em] underline-offset-4">l</u>l
          </span>
        </NavLink>

        <nav className="flex gap-4 font-mono text-[11px] font-medium tracking-[0.16em] uppercase">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'text-accent' : 'text-fg-dim hover:text-fg'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main
        className={`mx-auto ${WIDE_ROUTES.has(pathname) ? 'max-w-6xl' : 'max-w-3xl'} px-6 ${
          isSessionRoute(pathname) ? 'py-6' : 'py-10'
        }`}
      >
        {/* Boundary di dalam layout, direset saat rute berganti (dok. 02 §9): navigasi tetap
            hidup saat satu halaman gagal, dan pindah rute membersihkan error-nya. */}
        <RouteErrorBoundary resetKey={pathname}>
          <Suspense fallback={<p className="text-fg-dim">memuat…</p>}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
