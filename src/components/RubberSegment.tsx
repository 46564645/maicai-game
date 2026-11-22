/**
 * RubberSegment.tsx —— 收编自 React Bits「Rubber Segment」（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 *
 * 适配（motion 实现，与原组件同源思路）：
 * - 选中背景是一条「橡皮筋」胶囊 path：切换时按弹簧从旧位形变滑向
 *   新位，弹簧过冲出橡皮感；可按住拖动，松手吸附最近段。
 * - 原组件按任意段宽计算 path；本版保留同样的 rect→path 形变
 *   （插值 + 弹簧过冲），裁剪掉本项目用不到的垂直/受控指示器模式。
 * - prefers-reduced-motion：直接跳到选中位，无形变动画。
 * - 每段仍是原生 <button>：点击区 ≥48px、键盘 Tab/Enter 可切。
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 圆角胶囊 path（原组件同款形变思路：逐字段插值 + 弹簧过冲） */
function pillPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(w, h) / 2;
  return [
    `M ${x + r} ${y}`,
    `h ${Math.max(0, w - 2 * r)}`,
    `a ${r} ${r} 0 0 1 ${r} ${r}`,
    `v ${Math.max(0, h - 2 * r)}`,
    `a ${r} ${r} 0 0 1 ${-r} ${r}`,
    `h ${Math.max(0, -(w - 2 * r))}`,
    `a ${r} ${r} 0 0 1 ${-r} ${-r}`,
    `v ${Math.max(0, -(h - 2 * r))}`,
    `a ${r} ${r} 0 0 1 ${r} ${-r}`,
    'Z',
  ].join(' ');
}

function rubberPath(from: Rect, to: Rect, t: number): string {
  return pillPath(
    lerp(from.x, to.x, t),
    lerp(from.y, to.y, t),
    lerp(from.w, to.w, t),
    lerp(from.h, to.h, t),
  );
}

export interface RubberSegmentItem {
  value: string;
  label: string;
  ariaLabel?: string;
}

export interface RubberSegmentProps {
  items: RubberSegmentItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  /** 根上附加的钩子类（保留既有选择器用） */
  itemClassName?: string;
  itemOnClassName?: string;
  testid?: string;
  dataExtra?: Record<string, string>;
}

export function RubberSegment({
  items,
  value,
  onChange,
  className,
  style,
  ariaLabel,
  itemClassName,
  itemOnClassName,
  testid,
  dataExtra,
}: RubberSegmentProps) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const [view, setView] = useState({ w: 0, h: 0 });

  const mix = useMotionValue(1);
  const fromRect = useRef<Rect | null>(null);
  const toRect = useRef<Rect | null>(null);
  const dragRect = useRef<Rect | null>(null);
  const dragging = useRef(false);
  const movedPx = useRef(0);
  const prevValue = useRef(value);

  const measure = useCallback((v: string): Rect | null => {
    const wrap = wrapRef.current;
    const el = itemRefs.current.get(v);
    if (!wrap || !el) return null;
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height };
  }, []);

  const drawPath = useCallback((d: string) => {
    pathRef.current?.setAttribute('d', d);
  }, []);

  const settleAt = useCallback(
    (v: string) => {
      const r = measure(v);
      if (r) {
        toRect.current = r;
        drawPath(pillPath(r.x, r.y, r.w, r.h));
      }
    },
    [measure, drawPath],
  );

  const morphTo = useCallback(
    (from: Rect | null, to: Rect | null) => {
      if (!from || !to) return;
      fromRect.current = from;
      toRect.current = to;
      mix.set(0);
      if (reduce) {
        mix.set(1);
        drawPath(pillPath(to.x, to.y, to.w, to.h));
      } else {
        animate(mix, 1, { type: 'spring', stiffness: 400, damping: 27 });
      }
    },
    [mix, reduce, drawPath],
  );

  useMotionValueEvent(mix, 'change', (t) => {
    const a = fromRect.current;
    const b = toRect.current;
    if (!a || !b) return;
    drawPath(rubberPath(a, b, t));
  });

  /* 尺寸跟踪：包体大小变（窗口缩放/字号）→ 量 viewBox 并重落位 */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const sync = () => {
      const r = wrap.getBoundingClientRect();
      setView({ w: r.width, h: r.height });
      /* 有 pending 形变（选中刚变、effect 还没跑）时不抢画终位 */
      if (prevValue.current === value) settleAt(value);
    };
    sync();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(sync);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [value, items, settleAt]);

  /* 选中项变化（点击/拖动提交/父级改值）→ 橡皮形变滑过去 */
  useEffect(() => {
    if (prevValue.current === value) return;
    const from =
      dragRect.current ?? toRect.current ?? measure(prevValue.current);
    const to = measure(value);
    dragRect.current = null;
    prevValue.current = value;
    if (from && to) {
      morphTo(from, to);
    } else {
      settleAt(value);
    }
  }, [value, measure, morphTo, settleAt]);

  /* 拖动拇指：只在当前选中段上按住才可拖，松手吸附最近段 */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const btn = (e.target as Element).closest('button[data-rs-value]');
    if (!btn || btn.getAttribute('data-rs-value') !== value) return;
    dragging.current = true;
    movedPx.current = 0;
    try {
      wrapRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom 无捕获 API */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const wrap = wrapRef.current;
    const base = measure(value);
    if (!wrap || !base) return;
    const wr = wrap.getBoundingClientRect();
    const dx = e.clientX - (wr.left + base.x + base.w / 2);
    movedPx.current = Math.max(movedPx.current, Math.abs(dx));
    const wobble = Math.abs(dx) > 140 ? (Math.abs(dx) - 140) * 0.3 : 0;
    const rect: Rect = {
      x: base.x + dx - Math.sign(dx) * wobble,
      y: base.y,
      w: base.w,
      h: base.h,
    };
    dragRect.current = rect;
    drawPath(pillPath(rect.x, rect.y, rect.w, rect.h));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    /* 没挪过的按普通点击处理 */
    if (movedPx.current < 4) {
      dragRect.current = null;
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) return;
    const px = e.clientX - wrap.getBoundingClientRect().left;
    let nearest = items[0]?.value;
    let best = Infinity;
    for (const it of items) {
      const r = measure(it.value);
      if (!r) continue;
      const d = Math.abs(px - (r.x + r.w / 2));
      if (d < best) {
        best = d;
        nearest = it.value;
      }
    }
    if (!nearest || nearest === value) {
      /* 回原位 */
      dragRect.current = null;
      morphTo(fromRect.current, measure(value));
      return;
    }
    /* 从拖到的位置形变过去（effect 里取 dragRect） */
    onChange(nearest);
  };

  const onPointerCancel = () => {
    if (!dragging.current) return;
    dragging.current = false;
    dragRect.current = null;
    morphTo(fromRect.current, measure(value));
  };

  return (
    <div
      ref={wrapRef}
      className={`rubber-segment${className ? ` ${className}` : ''}`}
      style={style}
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testid}
      {...dataExtra}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={it.ariaLabel}
            data-rs-value={it.value}
            ref={(el) => {
              if (el) itemRefs.current.set(it.value, el);
              else itemRefs.current.delete(it.value);
            }}
            className={`rubber-segment__item${
              itemClassName ? ` ${itemClassName}` : ''
            }${on && itemOnClassName ? ` ${itemOnClassName}` : ''}`}
            onClick={() => onChange(it.value)}
          >
            <span className="rubber-segment__label">{it.label}</span>
          </button>
        );
      })}
      {/* 普通 svg（无 motion props——元素级动画全在 path 的 d 上，
          JS 直写） */}
      <svg
        className="rubber-segment__thumb"
        width={view.w}
        height={view.h}
        viewBox={`0 0 ${Math.max(view.w, 1)} ${Math.max(view.h, 1)}`}
        aria-hidden="true"
        focusable="false"
      >
        <path ref={pathRef} className="rubber-segment__thumb-path" />
      </svg>
    </div>
  );
}
