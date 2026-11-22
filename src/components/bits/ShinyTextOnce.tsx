/**
 * ShinyText.tsx —— React Bits「Shiny Text」裁剪改写（MIT + Commons
 * Clause，THIRD_PARTY_NOTICES.md 有登记）。原组件用 CSS keyframes 循环
 * 扫一道高光；本项目版式相同但扫光由 motion 驱动（不新增 CSS 动画），
 * 基色取元素实际计算色，文字本体保持不透明实色（对比度不变）。
 * WS3 C17：.weather-result 结果词的 sheen 扫光（单次扫过）。
 * reduced-motion：不扫，纯文字直出。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, useMotionTemplate, useMotionValue, useReducedMotion, motion } from 'motion/react';
import type { ReactNode } from 'react';

export interface ShinyTextOnceProps {
  children: ReactNode;
  className?: string;
  /** 一次扫光时长（秒），默认 2.4 */
  speed?: number;
  /** 首次扫光延迟（秒），默认 0.15 */
  delay?: number;
  /** 循环扫光；false = 只扫一次，默认 false（本项目只作入场强调） */
  loop?: boolean;
  /** 循环间隔（秒），默认 2 */
  repeatDelay?: number;
  /** 高光色，默认半透明白 */
  shineColor?: string;
}

export function ShinyTextOnce({
  children,
  className,
  speed = 2.4,
  delay = 0.15,
  loop = false,
  repeatDelay = 2,
  shineColor = 'rgba(255,255,255,0.92)',
}: ShinyTextOnceProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [base, setBase] = useState<string | null>(null);
  const pos = useMotionValue(120);

  // 基色 = 元素计算色（跟随 token/主题），扫光层叠在同一字形上
  useLayoutEffect(() => {
    if (ref.current) setBase(getComputedStyle(ref.current).color);
  }, []);

  useEffect(() => {
    if (reduce || !base) return undefined;
    pos.set(120);
    const controls = animate(pos, -120, {
      duration: speed,
      delay,
      ease: 'linear',
      repeat: loop ? Infinity : 0,
      repeatDelay,
    });
    return () => controls.stop();
  }, [reduce, base, speed, delay, loop, repeatDelay, pos]);

  const backgroundPosition = useMotionTemplate`${pos}% 50%`;

  if (reduce || !base) {
    return (
      <span ref={ref} className={className}>
        {children}
      </span>
    );
  }

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{
        backgroundImage: `linear-gradient(115deg, ${base} 0%, ${base} 42%, ${shineColor} 50%, ${base} 58%, ${base} 100%)`,
        backgroundSize: '220% 100%',
        backgroundPosition,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {children}
    </motion.span>
  );
}
