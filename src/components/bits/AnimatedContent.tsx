/**
 * AnimatedContent.tsx —— React Bits「Animated Content」改写（MIT + Commons
 * Clause，THIRD_PARTY_NOTICES.md 有登记）。原组件基于 gsap/ScrollTrigger；
 * 本项目不引入 gsap，用已装的 motion 重写同形设计：内容自下方
 * 抬升+淡入，可选驻留后再抬升淡出（disappearAfter / disappearDuration）。
 * WS3 C5：coin-delta-chip 的升起+淡出改由本组件在组件侧驱动，不再依赖
 * CSS 关键帧（coin-delta-rise 属 WS5 F26，勿动）。
 * reduced-motion：渲染纯静态终态（完全可见、无位移、无退出动画）。
 */
import { useReducedMotion, motion } from 'motion/react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/** 可透传到宿主 span 的 DOM 属性（剔除与 motion 事件签名冲突的拖拽/动画回调） */
type SpanRestProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  | 'children' | 'className' | 'style'
  | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onTransitionEnd'
  | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragEnter' | 'onDragLeave'
  | 'onDragOver' | 'onDrop'
>;

export interface AnimatedContentProps extends SpanRestProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 入场位移距离（px），默认 8 */
  distance?: number;
  /** 'vertical'=Y 轴抬升，'horizontal'=X 轴滑入 */
  direction?: 'vertical' | 'horizontal';
  /** 反向：从上方/左方进入 */
  reverse?: boolean;
  /** 入场时长（秒），默认 0.35 */
  duration?: number;
  /** 入场延迟（秒），默认 0 */
  delay?: number;
  /** 起始透明度，默认 0 */
  initialOpacity?: number;
  /** 入场缩放，默认 1（不缩放） */
  scale?: number;
  /** 驻留秒数后播退出；0/缺省 = 不退出 */
  disappearAfter?: number;
  /** 退出时长（秒），默认 0.4 */
  disappearDuration?: number;
  /** 退出位移（px），默认 -distance（反向抬升离场） */
  exitDistance?: number;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** SSR（node 环境无 window）下渲染静态标记——motion.* 元素 SSR 会访问 DOM */
const IS_BROWSER =
  typeof window !== 'undefined' && typeof document !== 'undefined';

export function AnimatedContent({
  children,
  className,
  style,
  distance = 8,
  direction = 'vertical',
  reverse = false,
  duration = 0.35,
  delay = 0,
  initialOpacity = 0,
  scale = 1,
  disappearAfter = 0,
  disappearDuration = 0.4,
  exitDistance,
  ...rest
}: AnimatedContentProps) {
  const reduce = useReducedMotion();
  if (reduce || !IS_BROWSER) {
    return (
      <span className={className} style={style} {...rest}>
        {children}
      </span>
    );
  }

  const axis = direction === 'horizontal' ? 'x' : 'y';
  const travel = (reverse ? -1 : 1) * distance;
  const initial = { opacity: initialOpacity, [axis]: travel, scale };

  // 单次入场：disappearAfter <= 0 时只淡入到终态。
  if (disappearAfter <= 0) {
    return (
      <motion.span
        className={className}
        style={style}
        {...rest}
        initial={initial}
        animate={{ opacity: 1, [axis]: 0, scale: 1 }}
        transition={{ duration, delay, ease: EASE_OUT }}
      >
        {children}
      </motion.span>
    );
  }

  // 入场 → 驻留 → 退出：一条 keyframes 时间轴，times 按比例切三段。
  const exit = exitDistance ?? -travel;
  const total = duration + disappearAfter + disappearDuration;
  const tIn = duration / total;
  const tHold = (duration + disappearAfter) / total;
  return (
    <motion.span
      className={className}
      style={style}
      {...rest}
      initial={initial}
      animate={{
        opacity: [initialOpacity, 1, 1, 0],
        [axis]: [travel, 0, 0, exit],
        scale: [scale, 1, 1, 1],
      }}
      transition={{
        duration: total,
        delay,
        times: [0, tIn, tHold, 1],
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.span>
  );
}
