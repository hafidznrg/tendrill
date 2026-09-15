import { FINGER_HOME, FINGER_LABEL, keyById, type KeyHint } from './fingerMap.ts';

/**
 * Keterangan satu baris untuk tombol yang sedang dijelajah di `/posture` (ADR-038).
 * Pure dan disusun dari tabel jari — tidak ada kalimat yang ditulis per tombol, jadi
 * layout lain (backlog Dvorak/Colemak) tidak butuh salinan teks baru.
 */

export interface HintDescription {
  /** Nama tombol yang dijelajah, siap ditampilkan di `<kbd>`. */
  key: string;
  /** "jari tengah kiri" dsb. */
  finger: string;
  /** Tombol istirahat jari itu; null kalau tombol ini sendiri tempat istirahatnya, atau spasi. */
  from: string | null;
  /** Shift yang ikut ditekan, sudah dengan jarinya; null tanpa Shift. */
  shift: { key: string; finger: string } | null;
}

const NAMES: Record<string, string> = {
  Backspace: 'Backspace',
  Tab: 'Tab',
  CapsLock: 'Caps Lock',
  Enter: 'Enter',
  ShiftLeft: 'Shift kiri',
  ShiftRight: 'Shift kanan',
  Space: 'Spasi',
};

/** Nama tombol untuk manusia: huruf kapital seperti tertulis di keycap sungguhan. */
export function keyName(keyId: string): string {
  return NAMES[keyId] ?? keyById(keyId)?.label.toUpperCase() ?? keyId;
}

export function describeHint(hint: KeyHint): HintDescription {
  const home = FINGER_HOME[hint.finger];
  const shiftKey = hint.shiftKeyId ? keyById(hint.shiftKeyId) : undefined;
  return {
    key: keyName(hint.keyId),
    finger: FINGER_LABEL[hint.finger],
    from: hint.finger === 'thumb' || home === hint.keyId ? null : keyName(home),
    shift:
      hint.shiftKeyId && shiftKey
        ? { key: keyName(hint.shiftKeyId), finger: FINGER_LABEL[shiftKey.finger] }
        : null,
  };
}
