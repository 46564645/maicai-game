/**
 * BlurText.tsx —— 收编自 React Bits「Blur Text」（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 *
 * 适配：整行按词拆分、逐词「柔焦 → 对焦」resolve（原组件逐词/逐字母
 * 多步关键帧精简为单词段 blur+opacity+轻微下沉的一次到位）；
 * motion 实现，挂载即播（大卡时刻即其触发时机）。
 * prefers-reduced-motion：整行直接呈现，不模糊不位移。
 */
import { motion, useReducedMotion } from 'motion/react';

export interface BlurTextProps {
  text: string;
  className?: string;
  /** 逐词间隔（ms），默认 90 —— 儿童向慢 resolve */
  staggerMs?: number;
  /** 单词动画时长（ms），默认 520 */
  duration?: number;
}

export function BlurText({
  text,
  className,
  staggerMs = 90,
  duration = 520,
}: BlurTextProps) {
  const reduce = useReducedMotion();
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  /* node 环境 SSR：无 document 时 motion 元素会炸——与 reduced-motion
     同路整行直接呈现（判 document：测试会装 window 替身） */
  if (reduce || typeof document === 'undefined') {
    return (
      <span className={`blur-text${className ? ` ${className}` : ''}`}>
        {text}
      </span>
    );
  }
  let wi = 0;
  return (
    <span
      className={`blur-text${className ? ` ${className}` : ''}`}
      aria-label={text}
    >
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i} aria-hidden="true">
            {w}
          </span>
        ) : (
          <motion.span
            key={i}
            className="blur-text__word"
            aria-hidden="true"
            initial={{ opacity: 0, filter: 'blur(7px)', y: 6 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{
              duration: duration / 1000,
              delay: (wi++ * staggerMs) / 1000,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            {w}
          </motion.span>
        ),
      )}
    </span>
  );
}
