/**
 * Suara ketik opsional (dok. 01 P1, dok. 02 §7) — ADR-035.
 *
 * Dimuat lewat `import()` hanya kalau `settings.soundEnabled` menyala, jadi
 * pengguna yang tidak memakainya tidak mengunduh satu byte pun.
 *
 * Satu bunyi untuk semua keystroke, benar maupun salah: dok. 01 prinsip 3
 * melarang "suara error yang keras". Error ditandai di layar, bukan diteriaki.
 *
 * Buffer dibangkitkan SEKALI. Yang tetap dialokasikan per keystroke hanyalah
 * `AudioBufferSourceNode` — node sekali pakai adalah satu-satunya cara Web Audio
 * memutar buffer. Itu pelanggaran "nol alokasi per keystroke" yang disengaja dan
 * dibatasi ke pengguna yang menyalakan suara (ADR-035); `perf:heap` mengukur
 * jalur default, yang tetap nol.
 */

const CLICK_MS = 14;
const VOLUME = 0.18;

export type Clicker = () => void;

export function createClicker(): Clicker {
  const Ctx =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};

  let ctx: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let gain: GainNode | null = null;

  // AudioContext dibuat pada keystroke pertama: browser menolak memutar suara
  // sebelum ada gestur pengguna, dan keydown adalah gestur itu.
  const init = (): boolean => {
    try {
      ctx = new Ctx();
      const length = Math.max(1, Math.round((ctx.sampleRate * CLICK_MS) / 1000));
      buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const ch = buffer.getChannelData(0);
      // Derau yang meluruh cepat — "tik" pendek, bukan nada.
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 4);
        ch[i] = (Math.random() * 2 - 1) * decay;
      }
      gain = ctx.createGain();
      gain.gain.value = VOLUME;
      gain.connect(ctx.destination);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  };

  let failed = false;
  return () => {
    if (failed) return;
    if (!ctx && !init()) {
      failed = true;
      return;
    }
    try {
      const src = ctx!.createBufferSource();
      src.buffer = buffer;
      src.connect(gain!);
      src.start();
    } catch {
      /* suara tidak boleh pernah mengganggu mengetik */
    }
  };
}
