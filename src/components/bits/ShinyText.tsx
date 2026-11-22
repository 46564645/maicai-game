/**
 * ShinyText.tsx —— React Bits「Shiny Text」移植裁剪版
 * （DavidHDev/react-bits，MIT + Commons Clause，见 THIRD_PARTY_NOTICES.md）。
 *
 * 只保留 loop 扫光核心（周期性一条高光扫过文字，backgroundImage 逐帧
 * 写 linear-gradient + background-clip:text）；砍掉 bands/glow/
 * followPointer/yoyo/hover/view 等未用档位。
 * prefers-reduced-motion：任何扫光都不启动，文字保持静态渐变色。
 */
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const FALLOFF = [0, 0.2, 0.4, 0.6, 0.8, 1];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

let paint: CanvasRenderingContext2D | null = null;

const parseColor = (value: string): number[] | null => {
  if (typeof document === 'undefined') return null;
  if (!paint) paint = document.createElement('canvas').getContext('2d');
  if (!paint) return null;
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  const resolved = String(paint.fillStyle);
  if (resolved.startsWith('#')) {
    return [1, 3, 5].map((i) => parseInt(resolved.slice(i, i + 2), 16)).concat(1);
  }
  const parts = resolved.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  return [Number(parts[0]), Number(parts[1]), Number(parts[2]), parts.length > 3 ? Number(parts[3]) : 1];
};

const blend = (from: number[], to: number[], amount: number) => {
  const channel = (a: number, b: number) =>
    Math.round(Math.pow(Math.pow(a / 255, 2.2) * (1 - amount) + Math.pow(b / 255, 2.2) * amount, 1 / 2.2) * 255);
  const alpha = from[3] * (1 - amount) + to[3] * amount;
  if (alpha <= 0) return 'rgba(0, 0, 0, 0)';
  const weigh = (a: number, b: number) => (a * from[3] * (1 - amount) + b * to[3] * amount) / alpha;
  const r = from[3] === to[3] ? channel(from[0], to[0]) : Math.round(weigh(from[0], to[0]));
  const g = from[3] === to[3] ? channel(from[1], to[1]) : Math.round(weigh(from[1], to[1]));
  const b = from[3] === to[3] ? channel(from[2], to[2]) : Math.round(weigh(from[2], to[2]));
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
};

export function ShinyText({
  children,
  color = '#fff7e6',
  shineColor = '#ffffff',
  /** 单次扫过时长（秒） */
  speed = 2.4,
  /** 两次扫光之间的间隔（秒） */
  delay = 3.2,
  angle = 105,
  shineWidth = 34,
  softness = 0.8,
  className,
  style,
}: {
  children?: ReactNode;
  color?: string;
  shineColor?: string;
  speed?: number;
  delay?: number;
  angle?: number;
  shineWidth?: number;
  softness?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const cfgRef = useRef({ color, shineColor, speed, delay, angle, shineWidth, softness });
  cfgRef.current = { color, shineColor, speed, delay, angle, shineWidth, softness };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) return undefined; /* 静态帧：CSS 里的渐变底即可读 */

    let raf = 0;
    let timer = 0;
    let alive = true;
    let base: number[] | null = null;
    let shine: number[] | null = null;
    let colors = '';
    let pos: number | null = null;
    let from = 0;
    let to = 0;
    let start = 0;
    let duration = 1;
    let phase: 'idle' | 'sweep' | 'wait' = 'idle';
    let resume = 0;

    const extent = () => cfgRef.current.shineWidth / 2 + 2;
    const entry = () => 100 + extent();
    const exit = () => -extent();

    const gradient = (p: number, fill: number[]) => {
      const s = cfgRef.current;
      const half = s.shineWidth / 2;
      const core = half * (1 - s.softness);
      const fade = half - core;
      const stops: [number, number][] = [];
      for (const side of [-1, 1]) {
        for (const f of FALLOFF) {
          const at = p + side * (core + fade * (1 - f));
          stops.push([at, f * f * (3 - 2 * f)]);
        }
      }
      stops.sort((a, b) => a[0] - b[0]);
      const list = stops.map(([at, amount]) => `${blend(fill, shine!, amount)} ${at.toFixed(2)}%`);
      return `linear-gradient(${s.angle}deg, ${blend(fill, shine!, 0)} 0%, ${list.join(', ')}, ${blend(
        fill,
        shine!,
        0,
      )} 100%)`;
    };

    const draw = () => {
      const s = cfgRef.current;
      const key = `${s.color}|${s.shineColor}`;
      if (key !== colors) {
        colors = key;
        base = parseColor(s.color);
        shine = parseColor(s.shineColor);
      }
      if (!base || !shine || pos === null) {
        root.style.backgroundImage = `linear-gradient(${s.color}, ${s.color})`;
        return;
      }
      root.style.backgroundImage = gradient(pos, base);
    };

    const sweep = (now: number) => {
      const s = cfgRef.current;
      phase = 'sweep';
      from = entry();
      to = exit();
      start = now;
      duration = Math.max(0.2, s.speed) * 1000;
    };

    const wake = () => {
      if (raf || !alive) return;
      raf = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      raf = 0;
      if (!alive) return;
      const s = cfgRef.current;
      if (phase === 'sweep') {
        const t = clamp((now - start) / duration, 0, 1);
        pos = from + (to - from) * (0.5 - Math.cos(Math.PI * t) / 2);
        draw();
        if (t < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        phase = 'wait';
        resume = now + s.delay * 1000;
        pos = null;
        draw();
      }
      if (phase === 'wait') {
        const wait = resume - now;
        if (wait > 0) {
          timer = window.setTimeout(wake, wait);
          return;
        }
        sweep(now);
        raf = requestAnimationFrame(tick);
      }
    };

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (phase === 'idle') {
        /* 入屏先等一拍再扫，避免按钮一出现就闪 */
        phase = 'wait';
        resume = performance.now() + Math.min(1200, cfgRef.current.delay * 400);
        wake();
      }
    });
    observer.observe(root);
    draw();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const cls = ['shiny-text', className].filter(Boolean).join(' ');
  return (
    <span
      ref={rootRef}
      className={cls}
      style={{ backgroundImage: `linear-gradient(${color}, ${color})`, ...style }}
    >
      {children}
    </span>
  );
}
