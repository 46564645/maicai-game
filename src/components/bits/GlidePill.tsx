/**
 * GlidePill.tsx —— 量测式滑动指示丸（React Bits「Pill Nav」glide 轨
 * 与「Glide Select」高亮丸共用的底层件，MIT + Commons Clause 设计
 * 移植，见 THIRD_PARTY_NOTICES.md）。
 *
 * useGlide() 返回 { trackRef, to, rect, reduce }：
 *   - trackRef 挂到相对定位的轨道容器上；
 *   - to(el) 以轨道为基准量出目标子元素的盒，指示丸用 motion 弹簧滑过去；
 *   - to(null) 指示丸淡出（留在原位，下次再滑出）。
 * prefers-reduced-motion：指示丸不滑动，直接跳到目标位。
 */
import { useCallback, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { canMotion } from './PressButton';

export interface GlideRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* 指示丸滑动弹簧：比按压弹簧慢一档，滑过去而不是弹过去 */
export const GLIDE_SPRING = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 26,
  mass: 1,
};

export function useGlide() {
  const reduce = useReducedMotion();
  const [rect, setRect] = useState<GlideRect | null>(null);
  const trackRef = useRef<HTMLElement | null>(null);

  const to = useCallback((el: HTMLElement | null) => {
    const track = trackRef.current;
    if (!el || !track) {
      setRect((r) => (r === null ? r : null));
      return;
    }
    const a = el.getBoundingClientRect();
    const b = track.getBoundingClientRect();
    const next = {
      x: a.left - b.left,
      y: a.top - b.top,
      w: a.width,
      h: a.height,
    };
    /* 矩形没变就不触发重渲染——GlideTrack 每次 render 后重锚选中项
       靠这个 bail-out 才不会打循环 */
    setRect((r) =>
      r && r.x === next.x && r.y === next.y && r.w === next.w && r.h === next.h ? r : next,
    );
  }, []);

  return { rect, to, trackRef, reduce };
}

export function GlidePill({
  rect,
  instant,
  className,
}: {
  rect: GlideRect | null;
  /** 首轮直接跳到目标位（如跟随已选态初始化） */
  instant?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const cls = ['glide-pill', className].filter(Boolean).join(' ');
  /* SSR / node 测试：无 motion 环境退回静止不可见丸 */
  if (!canMotion()) {
    return <span className={cls} aria-hidden="true" style={{ opacity: 0 }} />;
  }
  return (
    <motion.span
      className={cls}
      aria-hidden="true"
      initial={false}
      animate={
        rect
          ? { x: rect.x, y: rect.y, width: rect.w, height: rect.h, opacity: 1 }
          : { opacity: 0 }
      }
      transition={instant || reduce ? { duration: 0 } : GLIDE_SPRING}
    />
  );
}
