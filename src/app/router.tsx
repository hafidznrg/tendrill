import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { RouteErrorBoundary } from './layout/ErrorBoundary';

/**
 * Setiap rute = satu chunk terpisah (dok. 08 Fase 0 DoD, dok. 06 §6).
 * HomePage ikut lazy supaya bundel `main` hanya berisi shell, router,
 * dan (nanti) engine.
 *
 * Sengaja memakai router DEKLARATIF, bukan `createBrowserRouter`: mesin
 * data-router (loader/action/fetcher) memakan ~25 KB gzip di bundel awal
 * dan aplikasi ini tidak punya satu pun loader — tidak ada network saat
 * runtime (dok. 06 §2 batasan 4). Kalau suatu saat butuh data router,
 * ukur ulang anggarannya dulu.
 */
const HomePage = lazy(() => import('@/pages/HomePage'));
const LearnPage = lazy(() => import('@/pages/LearnPage'));
const LessonPage = lazy(() => import('@/pages/LessonPage'));
const PracticePage = lazy(() => import('@/pages/PracticePage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

export function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="learn/:lessonId" element={<LessonPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {/* TODO(Fase 3): /placement — dok. 02 §1. */}
          <Route path="*" element={<HomePage />} />
        </Route>
      </Routes>
    </RouteErrorBoundary>
  );
}
