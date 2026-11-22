/**
 * GlareHover.tsx —— React Bits「Glare Hover」裁剪移植（MIT + Commons
 * Clause，署名见 THIRD_PARTY_NOTICES.md）。原版是包一层 div 的扫光引擎
 * （hover/follow/loop/click 四模式 + streak/twin/sheen 三种光型）；
 * 这里裁成「光层」组件——渲染在宿主卡内部（卡面自带 overflow:hidden
 * 圆角裁切），监听挂到 host 元素上：
 *   · pointerdown（含触屏）→ 立即一次扫光（按压 <100ms 反馈）；
 *   · 鼠标 pointerenter → 一次扫光；触屏无 hover，不落；
 *   · :focus-visible 键盘焦点 → 一次扫光（键盘用户同享反馈）；
 *   · prefers-reduced-motion → 完全不扫（装饰层直接缺席）。
 * 只保留 sheen 光型（宽柔光带，与 TiltCard 的 .tc-glare 同族），
 * follow/loop 模式不移植（课堂产品无连续动画位）。扫光只走 transform，
 * 零 @keyframes、零常驻 rAF——不扫时不动一帧。
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export interface GlareHoverProps {
  /** 宿主元素（卡面按钮/卡根）：监听与几何量测都对着它 */
  host: RefObject<HTMLElement | null>;
  /** 扫光色（默认白，走 color-mix 透明化） */
  glareColor?: string;
  /** 光带峰值不透明度（0..1；卡面口径 ≤0.45，与 .tc-glare 0.3 同族） */
  glareOpacity?: number;
  /** 扫光行进角度（deg，-45 = 左上→右下） */
  glareAngle?: number;
  /** 光带宽 = 对角线百分比（默认 32%） */
  glareSize?: number;
  /** 单次扫光时长 ms（reduced-motion 下整个组件不工作） */
  transitionDuration?: number;
}

interface Geo {
  band: number;
  reach: number;
  angle: number;
}

const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function GlareHover({
  host,
  glareColor = '#ffffff',
  glareOpacity = 0.45,
  glareAngle = -45,
  glareSize = 32,
  transitionDuration = 620,
}: GlareHoverProps) {
  const glareRef = useRef<HTMLSpanElement>(null);
  const bandRef = useRef<HTMLSpanElement>(null);
  const settingsRef = useRef({ glareAngle, glareSize, transitionDuration });
  settingsRef.current = { glareAngle, glareSize, transitionDuration };

  useEffect(() => {
    const el = host.current;
    const band = bandRef.current;
    if (!el || !band || reduced()) return undefined;

    const geo: Geo = { band: 0, reach: 0, angle: settingsRef.current.glareAngle };
    const st = { pos: -1e4, from: 0, to: 0, start: 0, duration: 0, sweeping: false };
    let raf = 0;

    const write = () => {
      band.style.transform = `translate(-50%, -50%) rotate(${geo.angle - 90}deg) translateX(${st.pos.toFixed(2)}px)`;
    };

    const measure = () => {
      const s = settingsRef.current;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const rad = (s.glareAngle * Math.PI) / 180;
      const ux = Math.sin(rad);
      const uy = -Math.cos(rad);
      const diagonal = Math.hypot(w, h);
      geo.band = Math.max(8, (diagonal * s.glareSize) / 100);
      geo.reach = (Math.abs(w * ux) + Math.abs(h * uy)) / 2 + geo.band / 2 + 2;
      geo.angle = s.glareAngle;
      band.style.width = `${geo.band}px`;
      band.style.height = `${diagonal + geo.band}px`;
      if (!st.sweeping) {
        st.pos = -geo.reach;
        write();
      }
    };

    const frame = (now: number) => {
      const t = Math.min(1, (now - st.start) / st.duration);
      st.pos = st.from + (st.to - st.from) * ease(t);
      write();
      if (t < 1) raf = requestAnimationFrame(frame);
      else {
        st.sweeping = false;
        raf = 0;
      }
    };

    const sweep = () => {
      if (!geo.reach) return;
      // 连点连扫：未归位的从中途继续到对端（不跳变）
      st.from = st.pos;
      st.to = geo.reach;
      st.start = performance.now();
      st.duration = Math.max(
        120,
        settingsRef.current.transitionDuration * (Math.abs(st.to - st.from) / (2 * geo.reach)),
      );
      st.sweeping = true;
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // 触屏无 hover；扫光走 pointerdown
      sweep();
    };
    const onDown = () => sweep();
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element | null)?.matches?.(':focus-visible')) sweep();
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('focusin', onFocus);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    measure();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('focusin', onFocus);
    };
  }, [host]);

  // 光带渐变：sheen 型 = 宽柔单带，峰值不透明度 = glareOpacity
  const stops = [
    `color-mix(in srgb, ${glareColor} 0%, transparent) 0%`,
    `color-mix(in srgb, ${glareColor} ${Math.round(glareOpacity * 100)}%, transparent) 50%`,
    `color-mix(in srgb, ${glareColor} 0%, transparent) 100%`,
  ].join(', ');
  return (
    <span ref={glareRef} className="rb-gh" aria-hidden="true">
      <span
        ref={bandRef}
        className="rb-gh-band"
        style={{ background: `linear-gradient(90deg, ${stops})` }}
      />
    </span>
  );
}
