/**
 * PixelCard.tsx —— React Bits「Pixel Card」裁剪移植（MIT + Commons
 * Clause，署名见 THIRD_PARTY_NOTICES.md）。原版在卡面上常驻一层
 * canvas 像素格，悬停时随机点亮闪烁；本游戏裁剪为「按压萤火」：
 *   · 只在按下（pointerdown / Enter·Space）时播一簇像素慢明灭——
 *     触屏平板没有悬停，也不做常驻动画（省帧预算）；
 *   · 节奏压到很慢：每颗像素 ~350ms 淡入 + ~550ms 淡出、错峰
 *     ~380ms 内起步，远低于任何闪烁敏感阈值（给小小孩看）；
 *   · 一簇播完即停，无常驻 rAF；reduced-motion 不渲染像素层。
 * 裁掉项：原版三种 variant 的速度/配色预设、悬停监听、motion 依赖。
 */
import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface PixelCardProps {
  children: ReactNode;
  className?: string;
}

/** 一格像素的明灭生命（ms）；错峰起点在 STAGGER 内随机 */
interface Pixel {
  x: number;
  y: number;
  size: number;
  color: string;
  start: number;
  life: number;
}

const CELL = 7;
const STAGGER = 380;
const FADE_IN = 350;
const FADE_OUT = 550;
const COUNT = 14;
/* 暖色令牌系（与卡面暖白/橙黄同族），最大 α≈0.4 不抢眼 */
const COLORS = ['#f4b942', '#7ed9b5', '#b9a3f0', '#ff9d5c'];

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function PixelCard({ children, className = '' }: PixelCardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  /* SSR/降级环境安全：window 缺失时照渲染像素层（空 canvas 不可见） */
  const rm = reduced();

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const burst = () => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas || reduced()) return;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    if (w < CELL * 2 || h < CELL * 2) return;
    canvas.width = w;
    canvas.height = h;
    const cols = Math.max(1, Math.floor(w / CELL));
    const rows = Math.max(1, Math.floor(h / CELL));
    const pixels: Pixel[] = [];
    for (let i = 0; i < COUNT; i++) {
      pixels.push({
        x: Math.floor(Math.random() * cols) * CELL,
        y: Math.floor(Math.random() * rows) * CELL,
        size: CELL - 1,
        color: COLORS[i % COLORS.length],
        start: Math.random() * STAGGER,
        life: FADE_IN + FADE_OUT + Math.random() * 240,
      });
    }
    const t0 = performance.now();
    const ctx = canvas.getContext('2d');
    const tick = (now: number) => {
      if (!ctx) return;
      const t = now - t0;
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of pixels) {
        const local = t - p.start;
        if (local < 0) {
          alive = true;
          continue;
        }
        if (local >= p.life) continue;
        alive = true;
        /* 慢明灭：前 FADE_IN 淡入、剩余淡出（两段平滑，不闪） */
        const a =
          local < FADE_IN
            ? local / FADE_IN
            : 1 - (local - FADE_IN) / (p.life - FADE_IN);
        ctx.globalAlpha = Math.max(0, Math.min(0.4, a * 0.4));
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      if (alive) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        rafRef.current = 0;
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') burst();
  };

  return (
    <div
      ref={hostRef}
      className={`rb-pixel-host${className ? ` ${className}` : ''}`}
      onPointerDown={burst}
      onKeyDown={onKey}
    >
      {children}
      {!rm && (
        <span className="rb-pixel" aria-hidden="true">
          <canvas ref={canvasRef} />
        </span>
      )}
    </div>
  );
}
