/**
 * SwipeToast.tsx —— 收编自 React Bits「Swipe Toast」（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 *
 * 适配改动（相对原组件）：
 * - 原为屏幕右下自定位卡片（含 fixed 定位/inline 堆叠模式）——本版
 *   裁剪为「车道内包装层」：定位仍由外层 .toast-stack 负责，本组件只
 *   提供入场升起、燃烧引线倒计时与垂直滑甩关断三种行为。
 * - 原为 bottom 车道向下甩出——本版对顶部车道放开双向（朝任意屏幕缘
 *   甩都可关），更符合孩子随便一拨的期望。
 * - 原组件用 @hugeicons 图标——本版不内嵌任何图标（关闭 × 由调用方
 *   的按钮内容提供，保持项目既有样式）。
 * - 引线时长 = 真实驻留时长（由父级 Toast 的 4s 队列计时驱动）——
 *   本组件不另起关断计时，只把同一段时长画成燃烧的引线。
 * - prefers-reduced-motion：入场不移动；拖拽仍可（用户手势），回弹
 *   用更短时长；引线照常燃烧（它是信息不是装饰）。
 */
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';

/** 轻扫即认的拖距/速度阈值（孩子手上放宽一点） */
const DEAD_ZONE = 3; // px —— 低于此仍算点按
const SWIPE_DISTANCE = 40; // px
const FLICK_VELOCITY = 0.35; // px/ms
const DRAG_RESIST = 90; // px —— 超过此距离手感变韧

const BURN: Keyframe[] = [
  { transform: 'scaleX(1)' },
  { transform: 'scaleX(0)' },
];

export interface SwipeToastProps {
  /** 引线燃烧时长（ms）——应等于外层驻留时长 */
  duration: number;
  /** 甩出关断回调（只触发一次，随后交由外层同一条淡出/卸载路径） */
  onSwipe?: () => void;
  className?: string;
  children: ReactNode;
}

export function SwipeToast({
  duration,
  onSwipe,
  className,
  children,
}: SwipeToastProps) {
  const reduce = useReducedMotion();
  const liftRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<HTMLElement>(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, (v) => 1 - Math.min(Math.abs(v) / 200, 0.45));

  const moved = useRef(false);
  const suppressClick = useRef(false);
  const gone = useRef(false);
  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);

  /* 燃烧引线：挂载起 linear 燃尽 duration——与父级驻留计时同长同步 */
  useEffect(() => {
    const el = fuseRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const burn = el.animate(BURN, {
      duration,
      easing: 'linear',
      fill: 'forwards',
    });
    const onVis = () =>
      document.visibilityState === 'visible' ? burn.play() : burn.pause();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      burn.cancel();
    };
  }, [duration]);

  const swipeOut = useCallback(
    (dy: number, v: number) => {
      if (gone.current) return;
      gone.current = true;
      const dir = Math.sign(dy || v || -1);
      const h = liftRef.current?.offsetHeight ?? 60;
      animate(y, dy + dir * (h + 24), {
        duration: reduce ? 0.12 : 0.28,
        ease: 'easeIn',
      });
      onSwipe?.();
    },
    [y, onSwipe, reduce],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    moved.current = false;
    suppressClick.current = false;
    gone.current = false;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;
    velocity.current = 0;
    try {
      liftRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom / 旧浏览器无捕获 API 也无妨 */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lastT.current === 0 || gone.current) return;
    const dy = e.clientY - startY.current;
    const ady = Math.abs(dy);
    if (ady > DEAD_ZONE) moved.current = true;
    const clamped =
      ady > DRAG_RESIST
        ? Math.sign(dy) * (DRAG_RESIST + (ady - DRAG_RESIST) * 0.3)
        : dy;
    y.set(clamped);
    const dt = e.timeStamp - lastT.current;
    if (dt > 0) {
      const v = (e.clientY - lastY.current) / dt;
      velocity.current = velocity.current * 0.8 + v * 0.2;
    }
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;
  };

  const endDrag = () => {
    if (lastT.current === 0) return;
    lastT.current = 0;
    if (!moved.current) return;
    suppressClick.current = true;
    const dy = y.get();
    const v = velocity.current;
    if (Math.abs(dy) > SWIPE_DISTANCE || Math.abs(v) > FLICK_VELOCITY) {
      swipeOut(dy, v);
    } else {
      animate(y, 0, { type: 'spring', stiffness: 320, damping: 26 });
    }
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  /* node 环境 SSR（单测 renderToStaticMarkup）：无 document 时 motion
     元素构造 ProjectionNode 会炸——给同构静态骨架（入场终态）；
     判 document 不判 window（i18n 测试会装 window 替身） */
  if (typeof document === 'undefined') {
    return (
      <div className={`swipe-toast${className ? ` ${className}` : ''}`}>
        <div className="swipe-toast__gate">
          <div className="swipe-toast__lift">
            {children}
            <i className="swipe-toast__fuse" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`swipe-toast${className ? ` ${className}` : ''}`}>
      <motion.div
        className="swipe-toast__gate"
        initial={reduce ? false : { y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <motion.div
          ref={liftRef}
          className="swipe-toast__lift"
          style={{ y, opacity }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          {children}
          <i ref={fuseRef} className="swipe-toast__fuse" aria-hidden="true" />
        </motion.div>
      </motion.div>
    </div>
  );
}
