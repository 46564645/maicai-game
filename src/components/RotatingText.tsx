/**
 * RotatingText.tsx —— 收编自 React Bits「Rotating Text」（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 *
 * 适配：整句换场（splitBy 裁剪为按短语轮换）、上滑交叠（原组件逐词/
 * 逐字多模式精简为 D4 需要的单短语模式）；motion 实现不变。
 * 轮换间隔 ≥3s 由调用方保证（rotationInterval prop）。
 * prefers-reduced-motion：第一个短语常驻，不轮换不滑动。
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface RotatingTextProps {
  /** 轮换短语组；单条时恒静态 */
  texts: string[];
  /** 每条驻留时长（ms），默认 3000 —— D4 口径 ≥3s/短语 */
  rotationInterval?: number;
  className?: string;
}

export function RotatingText({
  texts,
  rotationInterval = 3000,
  className,
}: RotatingTextProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = texts.length;
  const current = texts[Math.min(index, Math.max(count - 1, 0))] ?? '';

  useEffect(() => {
    if (reduce || count < 2) return undefined;
    const t = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      Math.max(rotationInterval, 1000),
    );
    return () => window.clearInterval(t);
  }, [count, rotationInterval, reduce]);

  /* node 环境 SSR（单测 renderToStaticMarkup）：无 document 时 motion
     元素构造 ProjectionNode 会炸——直接给当前条静态终态；
     判 document 不判 window（i18n 测试会装 window 替身） */
  if (typeof document === 'undefined') {
    return (
      <span className={`rotating-text${className ? ` ${className}` : ''}`}>
        <span className="rotating-text__word" aria-hidden="true">
          {current}
        </span>
        <span className="sr-only">{current}</span>
      </span>
    );
  }

  return (
    <span className={`rotating-text${className ? ` ${className}` : ''}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={reduce || count < 2 ? 'static' : index}
          className="rotating-text__word"
          aria-hidden="true"
          initial={reduce ? false : { y: '70%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-70%', opacity: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {current}
        </motion.span>
      </AnimatePresence>
      {/* 读屏只拿静态当前句，不跟换场重复播报 */}
      <span className="sr-only">{current}</span>
    </span>
  );
}
