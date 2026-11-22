/**
 * SpotlightCard.tsx —— React Bits「Spotlight Card」裁剪移植（MIT +
 * Commons Clause，署名见 THIRD_PARTY_NOTICES.md）。原版是外包 div +
 * 光斑/颗粒/描边/环境漂移四层；这里裁成两层用法：
 *   · <SpotlightCard>：外包 div，内部自带光层（B22 Intro 数字卡可直接换用）；
 *   · <SpotlightLayer>：只有光层，挂 host 引用——贴进既有按钮/卡
 *     内部（B8 BotCard），不动卡体结构。
 * 裁掉项：beam 形、grain 噪点、edge 描边光、ambient 漂移、dark/light
 * 主题板（本项目只亮一种暖光）。保留原版核心引擎：光斑位置指数平滑
 * 跟随（lerp）、presence 渐显渐隐、按压 flare 微增——rAF 仅在激活期
 * 运行，落定即停。
 * 触发路径按课堂触屏口径：pointerdown 点亮（按压即 <100ms 反馈），
 * 按住拖动光斑跟随；键盘 focus-visible 在宿主中心点亮；
 * 鼠标 hover 不点亮（规格：press, not hover）。reduced-motion 下
 * 全部 lerping 一步到位（无光斑滑移动画），rAF 不循环。
 */
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';

export interface SpotlightSettings {
  /** 光斑色（默认暖奶油黄，落在暖白卡面上是「被照亮」不是「发光」） */
  color?: string;
  /** 光斑直径 px（相对卡尺寸给：小徽 90 / 数字卡 140） */
  size?: number;
  /** 峰值不透明度 0..1（默认 0.5——柔光，不洗文字） */
  intensity?: number;
  /** 位置平滑系数 0..1（越大越「液态」；reduced-motion 恒为一步到位） */
  smoothing?: number;
}

interface EngineOpts extends Required<SpotlightSettings> {}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** 光斑渐隐谱（移植原版 falloff 的柔边曲线，裁成 8 档） */
function falloff(color: string): string {
  const stop = (alpha: number, at: number) =>
    `color-mix(in srgb, ${color} ${(alpha * 100).toFixed(1)}%, transparent) ${(at * 100).toFixed(1)}%`;
  const list = [stop(1, 0)];
  for (let i = 1; i <= 8; i++) {
    const g = i / 8;
    const glow = Math.exp(-4.6 * g * g) * (1 - g ** 6);
    list.push(stop(glow, g));
  }
  return list.join(', ');
}

function useSpotlightEngine(
  host: RefObject<HTMLElement | null>,
  light: RefObject<HTMLElement | null>,
  opts: EngineOpts,
) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useEffect(() => {
    const root = host.current;
    const el = light.current;
    if (!root || !el) return undefined;

    const st = { x: 0, y: 0, presence: 0, pressed: false };
    const targetPoint = { x: 0, y: 0 };
    let focusEl: Element | null = null;
    let raf = 0;
    let last = 0;
    let alive = true;
    let fill = '';

    const paint = () => {
      const o = optsRef.current;
      const size = o.size;
      if (!fill) fill = falloff(o.color);
      el.style.background = `radial-gradient(circle ${size.toFixed(1)}px at ${st.x.toFixed(1)}px ${st.y.toFixed(1)}px, ${fill})`;
      el.style.opacity = String(clamp(st.presence * o.intensity, 0, 1));
    };

    const tick = (now: number) => {
      raf = 0;
      if (!alive) return;
      const o = optsRef.current;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const rect = root.getBoundingClientRect();
      let tx = st.x;
      let ty = st.y;
      let target = 0;
      if (focusEl && root.contains(focusEl)) {
        const box =
          focusEl === root ? rect : (focusEl as HTMLElement).getBoundingClientRect();
        tx = box.left + box.width / 2 - rect.left;
        ty = box.top + box.height / 2 - rect.top;
        target = 1;
      } else if (st.pressed) {
        target = 1; // tx/ty 已是最近按压点（pointerdown/move 写入 st.x/y 目标）
      }
      // 按压目标点存在 ref 里（target 点亮时跟随最近一次触点）
      const fx = targetPoint.x - rect.left;
      const fy = targetPoint.y - rect.top;
      if (st.pressed) {
        tx = fx;
        ty = fy;
      }
      if (st.presence < 0.02 && target > 0) {
        st.x = tx;
        st.y = ty; // 从暗处点亮时光斑直接在触点出现
      }
      const k = reduced()
        ? 1
        : o.smoothing === 0
          ? 1
          : 1 - Math.exp(-dt / (0.015 + o.smoothing * 0.22));
      st.x += (tx - st.x) * k;
      st.y += (ty - st.y) * k;
      const fade = reduced() ? 1 : 1 - Math.exp(-dt / (target > st.presence ? 0.09 : 0.3));
      st.presence += (target - st.presence) * fade;
      if (Math.abs(target - st.presence) < 0.003) st.presence = target;
      paint();
      const settled =
        Math.abs(tx - st.x) < 0.1 &&
        Math.abs(ty - st.y) < 0.1 &&
        st.presence === target;
      if (!settled) raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      targetPoint.x = e.clientX;
      targetPoint.y = e.clientY;
      st.pressed = true;
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!st.pressed) return;
      targetPoint.x = e.clientX;
      targetPoint.y = e.clientY;
      wake();
    };
    const onUp = () => {
      if (!st.pressed) return;
      st.pressed = false;
      wake();
    };
    const onFocusIn = (e: FocusEvent) => {
      if (!(e.target instanceof Element) || !e.target.matches(':focus-visible')) return;
      focusEl = e.target;
      wake();
    };
    const onFocusOut = (e: FocusEvent) => {
      if (root.contains(e.relatedTarget as Node | null)) return;
      focusEl = null;
      wake();
    };

    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      root.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [host, light]);
}

/** 只有光层的形态——贴进既有卡/按钮内部（卡需 position:relative +
 *  isolation:isolate，已在 reactbits.css 对宿主类补登） */
export function SpotlightLayer({
  host,
  color = '#ffd977',
  size = 96,
  intensity = 0.5,
  smoothing = 0.3,
}: SpotlightSettings & { host: RefObject<HTMLElement | null> }) {
  const lightRef = useRef<HTMLSpanElement>(null);
  useSpotlightEngine(host, lightRef, { color, size, intensity, smoothing });
  return <span ref={lightRef} className="rb-spot" aria-hidden="true" />;
}

/** 外包形态——自带光层的卡片容器（原版用法裁剪版） */
export function SpotlightCard({
  children,
  className = '',
  style,
  ...spot
}: SpotlightSettings & {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={rootRef} className={`rb-spot-card${className ? ` ${className}` : ''}`} style={style}>
      <SpotlightLayer host={rootRef} {...spot} />
      {children}
    </div>
  );
}
