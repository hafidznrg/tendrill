import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { hintFor, KEYBOARD_ROWS, type KeyDef, type KeyHint } from '../fingerMap.ts';
import { buildHands, poseIdFor, type HandsGeometry, type KeyRect } from '../hands.ts';
import { loadHandPoses, peekHandPoses, type HandPoses } from '../handPoses.ts';
import './virtual-keyboard.css';

/**
 * Virtual keyboard dengan panduan jari (dok. 07 §4).
 *
 * ⚠️ Seperti `TypingArea`, sorotan tombol berikutnya diperbarui **imperatif**:
 * satu penulisan `className` pada satu tombol, bukan render ulang seluruh
 * keyboard. Keyboard ini punya ~60 tombol dan diperbarui tiap keystroke —
 * merendernya ulang lewat React akan membatalkan seluruh kerja dok. 03 §7.
 * Siluet tangan (ADR-036, ADR-037) mengikuti aturan yang sama: pose tangan dan
 * panah jangkauan ditulis langsung ke atribut SVG, dengan string yang sudah ada.
 *
 * `aria-hidden` karena ia murni dekoratif: seluruh informasinya sudah ada di
 * teks target, dan membacakan 60 tombol ke screen reader tidak menolong siapa pun
 * (dok. 07 §8).
 */

export interface VirtualKeyboardProps {
  /**
   * Dipanggil dengan fungsi pelukis; pemanggil menyimpannya untuk jalur keystroke.
   * Argumen kedua melukis dari `KeyHint` langsung — untuk tombol non-karakter
   * (Tab, Shift, Backspace) yang dijelajah `/posture` (ADR-038). Layar sesi cukup
   * memakai yang pertama.
   */
  onReady: (
    paint: (char: string | null) => void,
    paintHint: (hint: KeyHint | null) => void,
  ) => void;
  showFingerColors?: boolean;
  /**
   * 'home' meredupkan tombol non-home row supaya baris awal menonjol (ADR-027).
   *
   * Satu class di elemen akar, disetel sekali saat render — ia TIDAK menyentuh
   * jalur keystroke, dan memang tidak boleh: pelukis sorotan tetap satu-satunya
   * yang berjalan per ketukan.
   */
  emphasis?: 'home' | null;
  /** Siluet tangan + panah jangkauan (ADR-036). Pemanggil yang memutuskan permukaannya. */
  showHands?: boolean;
}

/**
 * `hintFor` di-cache: jalur keystroke tidak boleh menghitung ulang peta karakter,
 * dan jumlah karakter berbeda dalam satu sesi selalu kecil.
 */
const hintCache = new Map<string, KeyHint | null>();
function hintForCached(char: string): KeyHint | null {
  let hit = hintCache.get(char);
  if (hit === undefined) {
    hit = hintFor(char);
    hintCache.set(char, hit);
  }
  return hit;
}

/** Elemen satu tangan; `pose` = id pose yang sedang tertulis, untuk melewati tulisan ulang. */
interface HandEls {
  g: SVGGElement;
  skin: SVGPathElement;
  line: SVGPathElement;
  glow: SVGPathElement;
  hl: SVGPathElement;
  pose: string;
}

interface HandsHandles {
  left: HandEls;
  right: HandEls;
  reachA: SVGPathElement;
  reachB: SVGPathElement;
  reach: Map<string, string>;
  poses: HandPoses;
}

function handEls(g: SVGGElement | null): HandEls | null {
  if (!g) return null;
  const q = (cls: string) => g.querySelector<SVGPathElement>(`.${cls}`);
  const skin = q('vk-skin');
  const line = q('vk-line');
  const glow = q('vk-glow');
  const hl = q('vk-hl');
  return skin && line && glow && hl ? { g, skin, line, glow, hl, pose: '' } : null;
}

export function VirtualKeyboard({
  onReady,
  showFingerColors = true,
  emphasis = null,
  showHands = false,
}: VirtualKeyboardProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const leftRef = useRef<SVGGElement | null>(null);
  const rightRef = useRef<SVGGElement | null>(null);
  const reachARef = useRef<SVGPathElement | null>(null);
  const reachBRef = useRef<SVGPathElement | null>(null);
  const markerId = useId();

  const [geo, setGeo] = useState<HandsGeometry | null>(null);
  const [poses, setPoses] = useState<HandPoses | null>(peekHandPoses);
  /** Pegangan siluet untuk pelukis; null selama siluet mati atau belum diukur. */
  const handsRef = useRef<HandsHandles | null>(null);
  /** Karakter yang sedang disorot — dicat ulang ke siluet begitu siluet siap. */
  const litHintRef = useRef<KeyHint | null>(null);
  /** Mengecat ulang siluet dari `litHintRef`; diisi efek pelukis. */
  const repaintHandsRef = useRef<() => void>(() => {});

  // Pengukuran posisi tombol: saat mount dan saat bingkai berubah ukuran (zoom,
  // resize — ADR-028). TIDAK PERNAH di jalur input (dok. 06 §2 poin 7).
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const host = hostRef.current;
    if (!showHands || !frame || !host) {
      setGeo(null);
      return;
    }
    let lastW = -1;
    let lastH = -1;
    const measure = () => {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      if (width === lastW && height === lastH) return;
      lastW = width;
      lastH = height;
      const rects = new Map<string, KeyRect>();
      for (const el of host.querySelectorAll<HTMLElement>('[data-key]')) {
        rects.set(el.dataset['key']!, {
          x: el.offsetLeft,
          y: el.offsetTop,
          w: el.offsetWidth,
          h: el.offsetHeight,
        });
      }
      setGeo(buildHands(rects, width, height));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [showHands]);

  // Data pose lazy (ADR-037). Ruang telapak sudah dipesan lewat class, jadi
  // tangan yang muncul belakangan tidak menggeser apa pun.
  useEffect(() => {
    if (!showHands || poses) return;
    let alive = true;
    void loadHandPoses().then((p) => {
      if (alive) setPoses(p);
    });
    return () => {
      alive = false;
    };
  }, [showHands, poses]);

  // Layout effect, bukan effect: pegangan dan pose istirahat wajib tertulis SEBELUM
  // paint pertama siluet — kalau tidak, satu frame tangan tanpa `d` sempat tampil.
  useLayoutEffect(() => {
    const left = handEls(leftRef.current);
    const right = handEls(rightRef.current);
    const reachA = reachARef.current;
    const reachB = reachBRef.current;
    handsRef.current =
      geo && poses && left && right && reachA && reachB
        ? { left, right, reachA, reachB, reach: geo.reach, poses }
        : null;
  }, [geo, poses]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const keyEls = new Map<string, HTMLElement>();
    for (const el of host.querySelectorAll<HTMLElement>('[data-key]')) {
      keyEls.set(el.dataset['key']!, el);
    }

    let lit: HTMLElement[] = [];
    /** undefined = belum ada / dibatalkan lukisan hint langsung. */
    let litFor: string | null | undefined = undefined;

    // Siluet: satu pose per tangan, ditulis hanya kalau berganti — `d` dari
    // string di modul data, jadi tidak ada yang dibuat per ketukan. Huruf-huruf
    // satu tangan ('ff jj' pun) melewati tangan yang lain sepenuhnya.
    const setPose = (el: HandEls, id: string, poses: HandPoses) => {
      if (el.pose === id) return;
      const pose = poses[id];
      if (!pose) return;
      el.pose = id;
      el.g.setAttribute('data-pose', id);
      el.skin.setAttribute('d', pose.skin);
      el.line.setAttribute('d', pose.line);
      el.glow.setAttribute('d', pose.hl);
      el.hl.setAttribute('d', pose.hl);
    };

    const paintHands = (hint: KeyHint | null) => {
      const hands = handsRef.current;
      if (!hands) return;
      setPose(hands.left, poseIdFor('left', hint), hands.poses);
      setPose(hands.right, poseIdFor('right', hint), hands.poses);
      hands.reachA.setAttribute('d', (hint && hands.reach.get(hint.keyId)) || '');
      hands.reachB.setAttribute(
        'd',
        (hint?.shiftKeyId && hands.reach.get(hint.shiftKeyId)) || '',
      );
    };

    // Pelukis: matikan sorotan lama, nyalakan yang baru. Maksimal 2 tombol
    // (huruf + Shift sisi berlawanan), jadi maksimal 4 penulisan className.
    const paintHint = (hint: KeyHint | null) => {
      litHintRef.current = hint;
      for (const el of lit) el.classList.remove('vk-next');
      lit = [];
      paintHands(hint);
      if (!hint) return;

      const keyEl = keyEls.get(hint.keyId);
      if (keyEl) {
        keyEl.classList.add('vk-next');
        lit.push(keyEl);
      }
      if (hint.shiftKeyId) {
        const shiftEl = keyEls.get(hint.shiftKeyId);
        if (shiftEl) {
          shiftEl.classList.add('vk-next');
          lit.push(shiftEl);
        }
      }
    };

    const paint = (char: string | null) => {
      // Karakter berulang tidak perlu dicat ulang. Drill Unit 1 penuh dengan
      // 'ff jj ff jj', jadi ini menghapus separuh penulisan DOM di sana.
      if (char === litFor) return;
      litFor = char;
      paintHint(char === null ? null : hintForCached(char));
    };

    // Lukisan langsung dari hint membatalkan cache karakter: `paint('f')` sesudahnya
    // wajib melukis ulang walau 'f' yang terakhir dilukis lewat `paint`.
    const paintHintExternal = (hint: KeyHint | null) => {
      litFor = undefined;
      paintHint(hint);
    };

    repaintHandsRef.current = () => paintHands(litHintRef.current);

    onReady(paint, paintHintExternal);
    // Siluet bisa sudah siap sebelum efek ini jalan (data pose ter-cache): lukis sekarang.
    repaintHandsRef.current();
    return () => onReady(noop, noop);
  }, [onReady]);

  // Siluet baru siap (mount atau resize) sesudah sorotan tombol mungkin sudah
  // dicat: salin sorotan yang sedang berlaku ke siluet.
  useLayoutEffect(() => {
    repaintHandsRef.current();
  }, [geo, poses]);

  return (
    <div
      className={`vk-frame${showHands ? ' vk-with-hands' : ''}`}
      ref={frameRef}
      aria-hidden="true"
    >
      <div
        className={`vk-root${showFingerColors ? '' : ' vk-mono'}${
          emphasis === 'home' ? ' vk-emphasis-home' : ''
        }`}
        ref={hostRef}
        aria-hidden="true"
      >
        {KEYBOARD_ROWS.map((row, i) => (
          <div className="vk-row" key={i}>
            {row.map((key) => (
              <Keycap key={key.id} def={key} />
            ))}
          </div>
        ))}
      </div>

      {showHands && geo && poses && (
        <svg
          className="vk-hands"
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          width={geo.width}
          height={geo.height}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M0,0L10,5L0,10Z" className="vk-reach-head" />
            </marker>
            {/* Pergelangan memudar ke bawah: tangan terpotong tegas terbaca stiker. */}
            <linearGradient id={`${markerId}-fade`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.7" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`${markerId}-mask`} maskUnits="userSpaceOnUse">
              <rect width={geo.width} height={geo.height} fill={`url(#${markerId}-fade)`} />
            </mask>
          </defs>
          <g mask={`url(#${markerId}-mask)`}>
            {/* Satu affine ruang keyboard → tombol terukur (ADR-037). `d` sengaja
                TIDAK diberikan lewat React: pelukis yang menulisnya, dan render ulang
                saat resize tidak boleh menimpa pose yang sedang tampil. */}
            <g transform={geo.transform}>
              {(['left', 'right'] as const).map((side) => (
                <g
                  className="vk-hand"
                  key={side}
                  data-hand={side}
                  ref={side === 'left' ? leftRef : rightRef}
                >
                  <path className="vk-skin" />
                  <path className="vk-line" />
                  <path className="vk-glow" />
                  <path className="vk-hl" />
                </g>
              ))}
            </g>
          </g>
          <path
            className="vk-reach"
            data-reach="a"
            ref={reachARef}
            d=""
            markerEnd={`url(#${markerId})`}
          />
          <path
            className="vk-reach"
            data-reach="b"
            ref={reachBRef}
            d=""
            markerEnd={`url(#${markerId})`}
          />
        </svg>
      )}
    </div>
  );
}

function noop(): void {}

function Keycap({ def }: { def: KeyDef }) {
  return (
    <span
      data-key={def.id}
      data-finger={def.finger}
      className={`vk-key${def.home ? ' vk-home' : ''}`}
      style={{ flexGrow: def.width ?? 1, flexBasis: `${(def.width ?? 1) * 2.2}rem` }}
    >
      {def.label}
    </span>
  );
}
