import { useEffect, useRef } from 'react';
import { CHAR_CLASS, type TypingSessionApi } from '../hooks/useTypingSession.ts';
import './typing-area.css';

/**
 * Lapisan teks sesi (dok. 03 §7, dok. 06 §2 poin 6).
 *
 * ⚠️ **Span dibangun dengan DOM langsung, bukan JSX. Ini disengaja.**
 *
 * `memo` mencegah re-render, **bukan** reconciliation: setiap render induk tetap
 * membuat dan membandingkan 500 elemen React. Dengan membangun span sekali
 * secara imperatif, keystroke berikutnya hanya menulis `className` pada 1–2
 * elemen — nol pekerjaan React sama sekali.
 *
 * Jangan mengubah ini menjadi `{cells.map(...)}` yang idiomatik. Kalau tergoda,
 * baca dok. 11 R-08 dulu: itu satu-satunya alasan anggaran p95 ≤ 8 ms tercapai.
 */

export interface TypingAreaProps {
  session: TypingSessionApi;
  charWidth: number;
  /** Jumlah baris yang terlihat sebelum teks bergulir. */
  visibleLines?: number;
  /** Dipanggil dengan elemen teks supaya induk bisa mengukur charWidth. */
  onMeasureEl?: (el: HTMLElement | null) => void;
}

export function TypingArea({
  session,
  charWidth,
  visibleLines = 3,
  onMeasureEl,
}: TypingAreaProps) {
  const textRef = useRef<HTMLDivElement | null>(null);
  const { sessionRef, structuralTick, registerSpans, registerCaret, registerViewport } =
    session;

  // Bangun span sekali per perubahan STRUKTURAL (ganti target / restart).
  useEffect(() => {
    const host = textRef.current;
    if (!host) return;

    const s = sessionRef.current;
    const spans: HTMLElement[] = new Array(s.cells.length);
    const fragment = document.createDocumentFragment();
    const lineBreaks = new Set(s.lineStarts.slice(1));

    for (let i = 0; i < s.cells.length; i++) {
      if (lineBreaks.has(i)) fragment.appendChild(document.createElement('br'));

      const cell = s.cells[i]!;
      const span = document.createElement('span');
      span.className = CHAR_CLASS[cell.state];
      // Spasi butuh lebar nyata supaya kolomnya tetap sejajar dengan aritmetika
      // caret; `white-space: pre` di CSS yang menjaganya.
      span.textContent = cell.expected === '\n' ? ' ' : cell.expected;
      spans[i] = span;
      fragment.appendChild(span);
    }

    host.replaceChildren(fragment);
    registerSpans(spans);

    return () => {
      host.replaceChildren();
      registerSpans([]);
    };
  }, [structuralTick, sessionRef, registerSpans]);

  return (
    <div
      className="ta-root"
      // Tinggi datang dari CSS (`--ta-lines`), BUKAN dari pengukuran — lihat
      // komentar di typing-area.css. Komponen ini sengaja TIDAK lagi menerima
      // `lineHeight`: selama ia ada, selalu ada godaan menurunkan ukuran dari
      // angka yang bernilai 0 sampai font siap. Pergeseran caret vertikal
      // memakai lineHeight, tapi itu milik useTypingSession, bukan di sini.
      style={{ ['--ta-lines' as string]: visibleLines }}
      aria-label="Area latihan mengetik"
    >
      <div className="ta-viewport" ref={registerViewport}>
        {/* Satu elemen yang sama dipakai untuk menampung span DAN untuk mengukur
            charWidth — mengukur dari elemen contoh terpisah berisiko font atau
            letter-spacing yang berbeda, dan caret akan meleset karenanya. */}
        <div
          className="ta-text"
          ref={(el) => {
            textRef.current = el;
            onMeasureEl?.(el);
          }}
        />
        <span
          className="ta-caret"
          ref={registerCaret}
          style={{ width: `${Math.max(2, charWidth * 0.08)}px` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
