import type { HandPose } from '@/data/hands/poses.ts';

/**
 * Pemuat data pose siluet (ADR-037). Data ~28 KB gzip dan hanya dibutuhkan saat
 * siluet diminta, jadi ia TIDAK BOLEH diimpor statis — `chunkgraph` menjaganya.
 * Hasilnya di-cache di modul: mount kedua (lesson berikutnya) langsung sinkron,
 * tanpa satu frame pun tanpa tangan.
 */

export type HandPoses = Readonly<Record<string, HandPose>>;

let cached: HandPoses | null = null;
let pending: Promise<HandPoses> | null = null;

export function peekHandPoses(): HandPoses | null {
  return cached;
}

export function loadHandPoses(): Promise<HandPoses> {
  pending ??= import('@/data/hands/poses.ts').then((m) => (cached = m.HAND_POSES));
  return pending;
}
