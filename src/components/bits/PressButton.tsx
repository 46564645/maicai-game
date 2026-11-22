/**
 * PressButton.tsx —— WS1 共享按钮基底（A1/A2/A3/A4/A16）。
 *
 * 设计移植自 React Bits「Glare Hover」（DavidHDev/react-bits，
 * MIT + Commons Clause，见 THIRD_PARTY_NOTICES.md）：
 * 一条柔光带在 pointerenter（鼠标悬停）与 pointerdown（触屏按下）
 * 时用 WAAPI 扫过按钮面；按压位移改用 motion 的 whileTap 弹簧，
 * 弹簧参数与 cards/useDragPlay.ts 沿用的 Magnet 口径一致
 * （stiffness 170 / damping 16 / mass 1）。
 *
 * 渲染仍是原生 <button>（motion.button），调用方的 className、
 * data-*、aria-*、onClick、ref 全部原样透传。
 */
import { forwardRef, useCallback, useRef } from 'react';
import type { ButtonHTMLAttributes, PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/* 运行环境能否承载 motion：motion.* 元素渲染期就建 ProjectionNode
   并往 window 挂 resize 监听——SSR / node 测试（window 替身缺
   addEventListener/matchMedia）会直接抛错。探不上的环境退回原生
   标签渲染（服务端本就跑不出动画）。 */
export function canMotion(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return (
    typeof window.addEventListener === 'function' &&
    typeof window.matchMedia === 'function'
  );
}

/* Magnet（React Bits）默认弹簧：stiffness 170 / damping 16 / mass 1 */
export const PRESS_SPRING = {
  type: 'spring' as const,
  stiffness: 170,
  damping: 16,
  mass: 1,
};

/* motion.button 的拖拽/动画回调与原生 DOM 事件签名冲突——
   本项目从不传这些键，直接从公开 props 类型里裁掉 */
export type PressButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onTransitionEnd'
>;

export const PressButton = forwardRef<HTMLButtonElement, PressButtonProps>(function PressButton(
  { children, className, onPointerEnter, onPointerDown, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const sheenRef = useRef<HTMLSpanElement>(null);

  const sweep = useCallback(() => {
    const el = sheenRef.current;
    if (!el || reduce) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { transform: 'translateX(-120%) skewX(-12deg)' },
        { transform: 'translateX(340%) skewX(-12deg)' },
      ],
      { duration: 620, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
    );
  }, [reduce]);

  const handleEnter = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'touch') sweep();
    onPointerEnter?.(e);
  };
  const handleDown = (e: PointerEvent<HTMLButtonElement>) => {
    sweep();
    onPointerDown?.(e);
  };

  const cls = ['bits-press', className].filter(Boolean).join(' ');
  /* SSR / node 测试（window 替身无事件面）：退回原生 <button>——
     服务端渲染本就跑不出扫光与弹簧（canMotion 探测见上） */
  if (!canMotion()) {
    return (
      <button type="button" className={className} ref={ref} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <motion.button
      type="button"
      className={cls}
      ref={ref}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={PRESS_SPRING}
      onPointerEnter={handleEnter}
      onPointerDown={handleDown}
      {...rest}
    >
      <span ref={sheenRef} className="bits-sheen" aria-hidden="true" />
      {children}
    </motion.button>
  );
});
