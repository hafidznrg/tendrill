import { useEffect, useState } from 'react';

/**
 * Pengukuran `charWidth` & `lineHeight` (dok. 03 §8, R-06).
 *
 * Wajib diukur **setelah `await document.fonts.ready`**. Mengukur sebelum
 * webfont termuat membuat caret meleset permanen: font fallback punya lebar
 * karakter berbeda, dan seluruh posisi caret dihitung aritmetika dari angka ini.
 *
 * Diukur ulang saat resize dan perubahan zoom (`visualViewport`). Ini SATU-SATUNYA
 * tempat pengukuran DOM terjadi — jalur input tidak pernah memanggil
 * `getBoundingClientRect()` (dok. 06 §2 batasan 7).
 *
 * Menerima **elemen**, bukan `RefObject`. Versi pertama memakai ref dan diam-diam
 * tidak pernah mengukur apa pun: efeknya jalan sekali saat mount, saat itu
 * elemennya belum ada (teks latihan masih dimuat), lalu tidak pernah jalan lagi
 * karena `ref` tidak pernah berubah identitas. Elemen sebagai state membuat
 * pengukuran ikut hidup kembali begitu elemennya benar-benar ada.
 */

export interface CharMetrics {
  charWidth: number;
  lineHeight: number;
  /** false sampai webfont termuat DAN pengukuran pertama berhasil */
  ready: boolean;
}

const SAMPLE = 'M'.repeat(50);

function measure(el: HTMLElement): { charWidth: number; lineHeight: number } {
  const probe = document.createElement('span');
  probe.textContent = SAMPLE;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'pre';
  probe.style.pointerEvents = 'none';
  el.appendChild(probe);

  const charWidth = probe.getBoundingClientRect().width / SAMPLE.length;
  const computed = getComputedStyle(el);
  const parsedLineHeight = Number.parseFloat(computed.lineHeight);
  const fontSize = Number.parseFloat(computed.fontSize) || 24;

  el.removeChild(probe);

  return {
    charWidth,
    // `line-height: normal` tidak bisa diparse; 1.8 mengikuti dok. 07 §6.
    lineHeight: Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.8,
  };
}

export function useCharMetrics(el: HTMLElement | null): CharMetrics {
  const [metrics, setMetrics] = useState<CharMetrics>({
    charWidth: 0,
    lineHeight: 0,
    ready: false,
  });

  useEffect(() => {
    if (!el) return;

    let cancelled = false;

    const remeasure = () => {
      if (cancelled) return;
      const next = measure(el);
      // Elemen yang belum ter-layout mengukur 0 — jangan pernah menandainya
      // "ready", karena seluruh posisi caret diturunkan dari angka ini.
      if (next.charWidth <= 0) return;
      setMetrics((prev) =>
        prev.ready && prev.charWidth === next.charWidth && prev.lineHeight === next.lineHeight
          ? prev
          : { ...next, ready: true },
      );
    };

    // Inilah aturan R-06: jangan mengukur apa pun sebelum font siap.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) void fonts.ready.then(remeasure);
    else remeasure();

    window.addEventListener('resize', remeasure);
    window.visualViewport?.addEventListener('resize', remeasure);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', remeasure);
      window.visualViewport?.removeEventListener('resize', remeasure);
    };
  }, [el]);

  return metrics;
}
