import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { ThemeToggle } from './ThemeToggle';
import markUrl from '@/assets/brand/mark.svg';

const NAV = [
  { to: '/learn', label: 'belajar' },
  { to: '/practice', label: 'latihan' },
  { to: '/stats', label: 'statistik' },
  { to: '/settings', label: 'pengaturan' },
] as const;

export function AppLayout() {
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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Suspense fallback={<p className="text-fg-dim">memuat…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
