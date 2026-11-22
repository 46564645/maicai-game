/**
 * AnimatedContent.tsx —— React Bits「Animated Content」改写
 * （原版依赖 gsap/ScrollTrigger → 本实现用 motion，MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md）。
 *
 * 入场揭示包装器：子元素挂载（或 enter 变 true）时按变体揭示——
 *  slide  滑入（位移 + 淡入，弹窗/天气卡口径）
 *  scale  弹入（缩放 + 淡入，成品菜/盘卡口径）
 *  blur   模糊弹入（缩放 + 模糊 + 淡入，事件揭示口径）
 *  pop    轻弹入（小幅缩放 + 上移，大卡/气泡口径）
 *  pop-x  pop 的「自带水平居中」档：x:-50% 贯穿进退场（横屏气泡口径）
 *  rise   升起（短距上移 + 淡入，增减小片口径）
 *  quest  翻落（上方滑入 + rotateX 翻落，任务卡入手口径）
 *  moment 大卡时刻弹入（沉幅 y + 小缩放 + 轻摆角，时刻卡/高光卡口径）
 *
 * reduced-motion（prefers-reduced-motion）：initial=false，直渲终态——
 * 无位移、无缩放、无模糊，子元素照常可见（与旧 no-preference 门同口径）。
 * 弹簧参数统一取 springs.ts，慢稳不炫技；enter=false 时不播（渲染普通 div）。
 */
import { motion, useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';
import { forwardRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { SPRING_POP, SPRING_SETTLE } from './springs';

export type AnimatedContentVariant =
  | 'slide'
  | 'scale'
  | 'blur'
  | 'pop'
  | 'pop-x'
  | 'rise'
  | 'quest'
  | 'moment';

function shownFor(variant: AnimatedContentVariant) {
  return {
    opacity: 1,
    x: variant === 'pop-x' ? '-50%' : 0,
    y: 0,
    scale: 1,
    rotate: 0,
    rotateX: 0,
    filter: 'blur(0px)',
  };
}

function hiddenFor(variant: AnimatedContentVariant, distance: number) {
  switch (variant) {
    case 'slide':
      return { opacity: 0, y: distance };
    case 'scale':
      return { opacity: 0, scale: 0.82 };
    case 'blur':
      return { opacity: 0, scale: 0.9, filter: 'blur(6px)' };
    case 'pop':
      return { opacity: 0, y: 8, scale: 0.85 };
    case 'pop-x':
      return { opacity: 0, x: '-50%', y: 6 };
    case 'rise':
      return { opacity: 0, y: 6 };
    case 'quest':
      return { opacity: 0, y: -28, rotateX: 55 };
    case 'moment':
      return { opacity: 0, y: 26, scale: 0.6, rotate: -4 };
  }
}

/** 小件（气泡/小片/手牌）用 POP，大件（大卡/盘卡/高光卡）用 SETTLE */
const POP_VARIANTS = new Set<AnimatedContentVariant>(['pop', 'pop-x', 'rise']);

export interface AnimatedContentProps {
  variant?: AnimatedContentVariant;
  /** slide 位移量（px），默认 26 */
  distance?: number;
  /** 入场延迟（ms），错峰用 */
  delay?: number;
  /** 弹簧参数（默认 SETTLE；小物件变体默认 POP） */
  spring?: Transition;
  /** false = 不播入场，直渲终态（已播过/重排不重演的口径） */
  enter?: boolean;
  className?: string;
  style?: CSSProperties;
  testid?: string;
  /** 装饰性内容（气泡/头像等）：透传 aria-hidden */
  ariaHidden?: boolean;
  children: ReactNode;
}

export const AnimatedContent = forwardRef<HTMLDivElement, AnimatedContentProps>(
  function AnimatedContent(
    {
      variant = 'slide',
      distance = 26,
      delay = 0,
      spring,
      enter = true,
      className,
      style,
      testid,
      ariaHidden,
      children,
    },
    ref,
  ) {
    const reduce = useReducedMotion();
    const live = enter && !reduce;
    const baseSpring = spring ?? (POP_VARIANTS.has(variant) ? SPRING_POP : SPRING_SETTLE);
    const transition: Transition = live ? { ...baseSpring, delay: delay / 1000 } : { duration: 0 };
    return (
      <motion.div
        ref={ref}
        className={className}
        style={{
          ...(variant === 'quest' ? { transformPerspective: 700 } : null),
          ...style,
        }}
        initial={live ? hiddenFor(variant, distance) : false}
        animate={shownFor(variant)}
        transition={transition}
        data-testid={testid}
        aria-hidden={ariaHidden || undefined}
      >
        {children}
      </motion.div>
    );
  },
);
