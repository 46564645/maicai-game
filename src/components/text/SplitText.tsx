/**
 * SplitText.tsx —— React Bits「Split Text」设计改写（MIT + Commons
 * Clause，THIRD_PARTY_NOTICES.md 有登记）。原组件基于 gsap/SplitText
 * 插件 + ScrollTrigger；本项目不引入 gsap，用 motion 重写同形设计：
 * 文本按字（含按词分组保证不断词）逐字升起+淡入的错峰入场。
 * WS3 C15：.game-title / .popup-title 的入场。错峰短促、入场即止，
 * 扫一眼就清楚；reduced-motion / SSR（node 环境无 window）= 静态文字直出。
 */
import { useReducedMotion, motion } from 'motion/react';
import type { ElementType } from 'react';

/** 可用的标题/文本标签 → 静态 motion 组件（渲染期不得现造 motion() 组件） */
const MOTION_TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
} as const;
type TagName = keyof typeof MOTION_TAGS;

/** SSR（renderToStaticMarkup / node env）下渲染纯静态标记——
 *  motion.* 元素在 SSR 走 projection 节点会访问 DOM，须绕开 */
const IS_BROWSER =
  typeof window !== 'undefined' && typeof document !== 'undefined';

export interface SplitTextProps {
  text: string;
  /** 渲染的标签（h1/h2/h3/p/span），默认 'span' */
  as?: TagName;
  className?: string;
  /** 每字间隔（秒），默认 0.03 */
  stagger?: number;
  /** 首字延迟（秒），默认 0 */
  delay?: number;
  /** 单字时长（秒），默认 0.42 */
  duration?: number;
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** 词分组：词内字不断行（词间空白处可折行），整词 inline-block。 */
function splitWords(text: string): string[][] {
  const words = text.split(/(\s+)/).filter((w) => w.length > 0);
  return words.map((w) => Array.from(w));
}

export function SplitText({
  text,
  as = 'span',
  className,
  stagger = 0.03,
  delay = 0,
  duration = 0.42,
}: SplitTextProps) {
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
      {/* 可访问性：真文本交给 sr-only，逐字碎片对读屏隐藏 */}
      <span className="sr-only">{text}</span>
      {/* key=text：文案换（如换站点标题）时整组碎片重挂载、重播入场 */}
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
                    initial={{ opacity: 0, y: '0.55em' }}
                    animate={{ opacity: 1, y: '0em' }}
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
