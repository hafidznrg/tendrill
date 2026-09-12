import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, render } from '@testing-library/react';
import { TypingStage } from '../components/TypingStage.tsx';
import type { SessionResult } from '@/lib/engine';

/**
 * Perpindahan drill tidak boleh bergantung pada teks drill-nya BERBEDA.
 *
 * `useTypingSession` membuat sesi baru hanya saat `target` berubah. Kalau
 * halaman memajukan drill tanpa menaikkan `runId`, dua drill berturutan yang
 * kebetulan berteks sama akan membiarkan sesi tetap `finished`: tidak ada
 * keystroke yang diterima lagi, `onFinish` tidak pernah menyala, dan layarnya
 * menggantung tanpa satu pun pesan error.
 *
 * Isi kurikulum hari ini tidak punya pasangan seperti itu — sudah diperiksa,
 * nol kejadian — tetapi drill statis ditulis tangan, dan "belum pernah terjadi"
 * bukan jaminan. Test ini menjaga MEKANISMENYA, bukan datanya; aturan datanya
 * dijaga terpisah oleh validator kurikulum.
 */

vi.mock('../hooks/useCharMetrics.ts', () => ({
  useCharMetrics: () => ({ charWidth: 10, lineHeight: 20, width: 400, ready: true }),
}));

const SAME = 'fff jjj';

function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function typeAll(text: string): void {
  for (const char of text) press(char);
}

/** Cermin `LessonPage`: dua drill berteks IDENTIK, maju dengan menaikkan runId. */
function Harness({ onFinish }: { onFinish: (r: SessionResult | null) => void }) {
  const [index, setIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  const drills = [SAME, SAME];

  return (
    <TypingStage
      target={drills[index]!}
      title={`drill ${index + 1}/2`}
      runId={runId}
      onFinish={(r) => {
        onFinish(r);
        if (index < drills.length - 1) {
          setIndex(index + 1);
          setRunId((n) => n + 1);
        }
      }}
    />
  );
}

describe('perpindahan drill (temuan audit Fase 1–4)', () => {
  it('dua drill berteks identik tetap berjalan sampai selesai', () => {
    const finished: Array<SessionResult | null> = [];
    render(<Harness onFinish={(r) => finished.push(r)} />);

    typeAll(SAME);
    expect(finished).toHaveLength(1);

    // Drill kedua: teks yang sama persis. Tanpa `runId`, sesi masih `finished`
    // dan keystroke di bawah ini tidak menghasilkan apa-apa.
    typeAll(SAME);
    expect(finished).toHaveLength(2);
    expect(finished[1]?.totalKeystrokes).toBe(SAME.length);
  });
});
