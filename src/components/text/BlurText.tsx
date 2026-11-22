/**
 * BlurText.tsx —— React Bits「Blur Text」改写（MIT + Commons Clause，
 * THIRD_PARTY_NOTICES.md 有登记）。原组件即 framer-motion 实现，这里
 * 以 motion 重写同形设计并按本项目裁剪：逐字「失焦→聚焦」软化解像
 * （blur+opacity+轻微上浮），词分组不断词。
 * WS3 C15：.intro-title 等屏幕级标题的入场——错峰 + 焦点回落一次完成。
 * reduced-motion / SSR（node 环境无 window）= 静态文字直出。
 */
import { useReducedMotion, motion } from 'motion/react';
import type { ElementType } from 'react';

/** 同 SplitText：标签 → 静态 motion 组件映射 */
const MOTION_TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
} as const;
type TagName = keyof typeof MOTION_TAGS;

const IS_BROWSER =
  typeof window !== 'undefined' && typeof document !== 'undefined';

export interface BlurTextProps {
  text: string;
  as?: TagName;
  className?: string;
  /** 每字间隔（秒），默认 0.028 */
  stagger?: number;
  delay?: number;
  duration?: number;
  /** 起始模糊半径（px），默认 6 */
  blur?: number;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function splitWords(text: string): string[][] {
  return text
    .split(/(\s+)/)
    .filter((w) => w.length > 0)
    .map((w) => Array.from(w));
}

export function BlurText({
  text,
  as = 'span',
  className,
  stagger = 0.028,
  delay = 0,
  duration = 0.5,
  blur = 6,
}: BlurTextProps) {
  const reduce = useReducedMotion();
  if (reduce || !IS_BROWSER) {
    const Tag = as as ElementType;
    return <Tag className={className}>{text}</Tag>;
  }

  const MotionTag = MOTION_TAGS[as];
  const words = splitWords(text);
  let rank = 0;
  return (
    <MotionTag className={className}>
      <span className="sr-only">{text}</span>
      {/* key=text：文案换时重播焦点回落 */}
      <span key={text} aria-hidden="true" style={{ display: 'contents' }}>
        {words.map((chars, wi) =>
          /^\s+$/.test(chars.join('')) ? (
            <span key={wi}>{chars.join('')}</span>
          ) : (
            <span
              key={wi}
              style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
            >
              {chars.map((ch, ci) => {
                const d = delay + rank++ * stagger;
                return (
                  <motion.span
                    key={ci}
                    style={{ display: 'inline-block' }}
                    initial={{ opacity: 0, filter: `blur(${blur}px)`, y: '0.25em' }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: '0em' }}
                    transition={{ duration, delay: d, ease: EASE_OUT }}
                  >
                    {ch}
                  </motion.span>
                );
              })}
            </span>
          ),
        )}
      </span>
    </MotionTag>
  );
}
