export {
  ADAPTIVE_LENGTH,
  MIN_KEY_OCCURRENCES,
  MIN_SESSIONS,
  MIN_WEAK_SCORE,
  WEAK_KEY_COUNT,
  adaptiveReadiness,
  buildAdaptiveText,
  letterStats,
  syllableFor,
  vocabularyFrom,
  weakKeyLabel,
  weakKeys,
} from './adaptive.ts';
export type { AdaptiveReadiness, AdaptiveShape, WeakKey } from './adaptive.ts';
export { loadAdaptiveReadiness } from './load.ts';
