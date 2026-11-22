/**
 * Stack.tsx —— React Bits「Stack」裁剪移植（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。原版是一摞牌：顶卡可拖可甩，
 * 甩过阈值后顶卡穿到摞底、下一张弹簧顶上（motion/physics 驱动）。
 * 本游戏抽牌堆只有一张真顶卡（底层是装饰牌背），裁剪为同一手感：
 *   · 按住顶卡拖动：卡跟手位移+轻旋，底卡向前挪一档（原版
 *     「next card comes forward」的预演）；
 *   · 松手位移小 → 弹簧弹回顶位；
 *   · 松手位移大 → 「甩穿牌堆」：卡沿甩向飞离摞面 → 从摞底
 *     重新弹回顶位（牌背全同，穿摞循环视觉等价）；
 *   · **点按永远是主路径**：位移不过阈值/tap-rescue 一律放行原生
 *     click（点抽牌），拖拽只是增强；拖动后的那次 click 被吞。
 * 动效口径：全部 transform 直写 + CSS transition 弹簧，无 motion、
 * 无 @keyframes；reduced-motion 下拖动手感保留但一切归位瞬移。
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  dragThresholdFor,
  exceedsDragThreshold,
  isTapRescue,
} from '../cards/useDragPlay';

export interface StackProps {
  /** 顶卡卡面（摞顶那张——本游戏为翻牌引擎 TiltCard） */
  top: ReactNode;
  /** 顶卡之下的底卡（装饰层；数组顺序 = 离顶近→远） */
  unders?: ReactNode[];
  /** 顶卡按钮 a11y 名（点按 = 主路径） */
  topAriaLabel: string;
  topTestId?: string;
  topDataKey?: number;
  /** 渲染 data-primary（键盘 Enter/Space 主动作标记） */
  topPrimary?: boolean;
  topDisabled?: boolean;
  /** 顶卡点按回调（原生命名 onTap，拖拽产生的 click 不会到这） */
  onTopTap: () => void;
  /** 顶卡按钮的额外类名（沿用产品既有皮肤类，如 deck-top） */
  topClassName?: string;
  /** 根元素的额外内容（如悬浮提示句，渲染在底卡之前） */
  children?: ReactNode;
  className?: string;
}

/** 甩穿阈值（px）：松手位移超它 = 甩，之下 = 弹回 */
const FLICK_DIST = 64;
/** 甩出段时长 / 回摞弹簧时长（ms） */
const FLY_MS = 190;
const RETURN_MS = 340;

const SPRING = 'cubic-bezier(0.22, 1.5, 0.36, 1)';
const EASE_OUT = 'cubic-bezier(0.3, 0.7, 0.4, 1)';

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function Stack({
  top,
  unders = [],
  topAriaLabel,
  topTestId,
  topDataKey,
  topPrimary,
  topDisabled,
  onTopTap,
  topClassName = '',
  children,
  className = '',
}: StackProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const visRef = useRef<HTMLSpanElement>(null);
  const st = useRef({
    active: false,
    moved: false,
    flying: false,
    pointerId: -1,
    sx: 0,
    sy: 0,
    ptype: 'mouse',
    t0: 0,
  });
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    },
    [],
  );

  const setCls = (name: string, on: boolean) =>
    rootRef.current?.classList.toggle(name, on);

  /** 顶卡视觉层归位（animate=false 瞬移；true 弹簧滑回） */
  const settle = useCallback((animate: boolean) => {
    const v = visRef.current;
    if (!v) return;
    v.style.transition =
      animate && !reduced() ? `transform ${RETURN_MS}ms ${SPRING}` : 'none';
    v.style.transform = '';
    setCls('rb-stack--drag', false);
    timers.current.push(
      window.setTimeout(() => {
        if (visRef.current) visRef.current.style.transition = '';
      }, RETURN_MS + 30),
    );
  }, []);

  /** 甩穿牌堆：先沿甩向飞出，再从摞底弹回顶位 */
  const flickThrough = useCallback((dx: number, dy: number) => {
    const v = visRef.current;
    const btn = btnRef.current;
    if (!v || !btn) return;
    st.current.flying = true;
    setCls('rb-stack--drag', false);
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const rot = Math.max(-16, Math.min(16, dx * 0.12));
    v.style.transition = `transform ${FLY_MS}ms ${EASE_OUT}`;
    v.style.transform = `translate3d(${dx + nx * 220}px, ${dy + ny * 220}px, 0) rotate(${rot}deg) scale(1.02)`;
    timers.current.push(
      window.setTimeout(() => {
        const h = btn.offsetHeight || 160;
        /* 瞬移到摞正下方（不可见段），再弹簧落回顶位 */
        v.style.transition = 'none';
        v.style.transform = `translate3d(0px, ${h * 1.15}px, 0) scale(0.92)`;
        requestAnimationFrame(() => {
          v.style.transition = `transform ${RETURN_MS}ms ${SPRING}`;
          v.style.transform = '';
          timers.current.push(
            window.setTimeout(() => {
              st.current.flying = false;
              if (visRef.current) visRef.current.style.transition = '';
            }, RETURN_MS + 30),
          );
        });
      }, FLY_MS),
    );
  }, []);

  /** 打断甩飞/回位（点按时调用：视觉立刻归位再抽牌） */
  const cancelMotion = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
    st.current.flying = false;
    const v = visRef.current;
    if (v) {
      v.style.transition = 'none';
      v.style.transform = '';
    }
    setCls('rb-stack--drag', false);
  }, []);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const s = st.current;
      if (!s.active || e.pointerId !== s.pointerId) return;
      const dx = e.clientX - s.sx;
      const dy = e.clientY - s.sy;
      if (!s.moved && !exceedsDragThreshold(dx, dy, dragThresholdFor(s.ptype))) return;
      if (!s.moved) {
        s.moved = true;
        setCls('rb-stack--drag', true);
      }
      const v = visRef.current;
      if (v) {
        v.style.transition = 'none';
        const rot = Math.max(-10, Math.min(10, dx / 22));
        v.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg) scale(1.04)`;
      }
      e.preventDefault();
    },
    [],
  );

  const onUp = useCallback(
    (e: PointerEvent) => {
      const s = st.current;
      if (!s.active || e.pointerId !== s.pointerId) return;
      s.active = false;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (!s.moved) return;
      const dx = e.clientX - s.sx;
      const dy = e.clientY - s.sy;
      // tap-rescue：小位移短时长仍算点按（与 useDragPlay 同口径）
      if (isTapRescue(dx, dy, e.timeStamp - s.t0)) {
        s.moved = false;
        settle(false);
        return;
      }
      if (reduced()) {
        // reduced-motion：甩/弹动画全免，视觉瞬移归位
        settle(false);
        return;
      }
      if (Math.hypot(dx, dy) >= FLICK_DIST) {
        flickThrough(dx, dy);
      } else {
        settle(true);
      }
    },
    [flickThrough, onMove, settle],
  );

  const onCancel = useCallback(
    (e: PointerEvent) => {
      const s = st.current;
      if (!s.active || e.pointerId !== s.pointerId) return;
      s.active = false;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (s.moved) settle(true);
    },
    [onMove, onUp, settle],
  );

  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (topDisabled || !e.isPrimary || e.button !== 0) return;
    const s = st.current;
    s.active = true;
    s.moved = false;
    s.pointerId = e.pointerId;
    s.ptype = e.pointerType;
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.t0 = e.timeStamp;
    try {
      btnRef.current?.setPointerCapture?.(e.pointerId);
    } catch {
      /* jsdom 等无实现——window 监听兜底 */
    }
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
  };

  return (
    <div ref={rootRef} className={`rb-stack${className ? ` ${className}` : ''}`}>
      {children}
      {unders}
      <button
        type="button"
        ref={btnRef}
        className={`rb-stack-top${topClassName ? ` ${topClassName}` : ''}`}
        disabled={topDisabled}
        aria-label={topAriaLabel}
        data-testid={topTestId}
        data-key={topDataKey}
        data-primary={topPrimary ? 'true' : undefined}
        onPointerDown={onDown}
        onClick={() => {
          cancelMotion();
          onTopTap();
        }}
        onClickCapture={(e) => {
          // 拖/甩收尾紧跟的那次 click 吞掉（否则拖完会误触发点按）
          if (st.current.moved) {
            st.current.moved = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <span ref={visRef} className="rb-stack-visual">
          {top}
        </span>
      </button>
    </div>
  );
}
