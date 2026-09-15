export { VirtualKeyboard } from './components/VirtualKeyboard.tsx';
export { FingerCards } from './components/FingerCards.tsx';
export { useKeyExplorer, hintFromKeyEvent, type PaintHint } from './useKeyExplorer.ts';
export { describeHint, keyName, type HintDescription } from './describe.ts';
export {
  fingerFor,
  hintFor,
  hintForKey,
  keyIdFromCode,
  keyById,
  handOf,
  FINGER_LABEL,
  FINGER_HOME,
  SHIFT_FINGER,
  KEYBOARD_ROWS,
  ALL_KEYS,
} from './fingerMap.ts';
export type { Finger, KeyDef, KeyHint } from './fingerMap.ts';
