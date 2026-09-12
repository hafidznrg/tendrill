/**
 * Permukaan publik engine (dok. 03 §9).
 *
 * Aturan yang mengikat: apa pun di luar folder ini mengimpor DARI SINI, bukan
 * dari file dalamnya. Itu yang menjaga engine tetap bisa ditukar isinya tanpa
 * menyentuh UI — dan menjaga batasan dok. 06 §2 #1 tetap mudah diperiksa.
 */

export {
  createSession,
  restartSession,
  applyKey,
  applyBackspace,
  pause,
  resume,
  finishSession,
  VOID_THRESHOLD_MS,
} from './session.ts';
export { computeLiveMetrics, computeResult, activeElapsedMs } from './metrics.ts';
export { combineResults } from './combine.ts';
export { generateLetterDrill, generateWordDrill, keyWeights } from './generator.ts';
export { wrapText, rowOf, colOf } from './wrap.ts';
export { consistencyFrom, intervalStdev } from './accumulators.ts';

export type {
  DrillShape,
  KeyUsage,
  KeyUsageMap,
  WordDrillShape,
} from './generator.ts';

export type {
  CharCell,
  CharState,
  Confusion,
  KeyLatency,
  KeyOutcome,
  KeystrokeLog,
  LiveMetrics,
  SessionResult,
  SessionState,
  SessionStatus,
} from './types.ts';
