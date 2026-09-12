export { UnitList } from './components/UnitList.tsx';
export {
  ASSIST_WPM_FACTOR,
  PASSED_STATUSES,
  assistFor,
  effectiveCriteria,
  emptyLessonProgress,
  entryFor,
  isPassed,
  lessonViews,
  markPassedWithAssist,
  meetsCriteria,
  nextLessonId,
  recordAttempt,
  unlockedLessonIds,
} from './progress.ts';
export { applyPlacement, placementTier, weakSkippedCluster } from './placement.ts';
export { microDrillFor, resolveDrills } from './drills.ts';
export { loadLesson, loadUnitLessons, unitIdOf } from './loadLesson.ts';
export type { LoadedLesson } from './loadLesson.ts';
export { readDrillStats, useProgress } from './useProgress.ts';

export type { AssistState, AttemptOutcome, LessonView } from './progress.ts';
export type { PlacementTier, WeakClusterHint } from './placement.ts';
export type { DrillStats } from './drills.ts';
export type { UseProgressApi } from './useProgress.ts';
export type { UnitListProps } from './components/UnitList.tsx';
