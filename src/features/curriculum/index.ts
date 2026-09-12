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
export { microDrillFor, resolveDrills, resolveDrillTexts } from './drills.ts';
export { gradeAttempt } from './grading.ts';
export { loadLesson, loadUnitLessons, unitIdOf } from './loadLesson.ts';
export type { LoadedLesson } from './loadLesson.ts';
export { readDrillStats, useProgress } from './useProgress.ts';

export type { AssistState, AttemptOutcome, LessonView } from './progress.ts';
export type { PlacementTier, WeakClusterHint } from './placement.ts';
export type { DrillStats, ResolvedDrill } from './drills.ts';
export type { GradedAttempt, GradedPart } from './grading.ts';
export type { UseProgressApi } from './useProgress.ts';
export type { UnitListProps } from './components/UnitList.tsx';
