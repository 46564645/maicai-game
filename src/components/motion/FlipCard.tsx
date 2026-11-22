/**
 * FlipCard.tsx —— React Bits「Flip Card」改写（MIT + Commons Clause，
 * 署名见 THIRD_PARTY_NOTICES.md；原版 hover 翻面 + CSS transition，
 * 本实现 motion 弹簧 rotateY，SPRING_FLIP ≈ 560ms 的翻牌手感）。
 *
 * 两种用法：
 *   <FlipCard front back flipped={bool} />  受控双面翻面（3D 双面贴，
 *     backface-hidden；flipped 换边由消费方驱动）
 *   <FlipCard reveal front={…} />           单面入场翻落——旧 card-flip
 *     keyframe 的等价物：rotateY 75° + 上方 22px + 25% 淡入 → 正立
 *     （菜谱大卡揭面/牌面揭示口径）
 *
 * reduced-motion：直渲终态（transition 缩短到 REDUCED_MS，视觉上即切）。
 */
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';
import { REDUCED_MS, SPRING_FLIP } from './springs';

export interface FlipCardProps {
  front: ReactNode;
  /** 双面模式的背面；缺省且 reveal=true 时为单面入场翻落 */
  back?: ReactNode;
  /** 双面模式：受控翻到哪面（false=front） */
  flipped?: boolean;
  /** 单面入场模式：挂载即播 rotateY 75°→0 的翻落揭示 */
  reveal?: boolean;
  className?: string;
  style?: CSSProperties;
  testid?: string;
}

export function FlipCard({
  front,
  back,
  flipped = false,
  reveal = false,
  className,
  style,
  testid,
}: FlipCardProps) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: REDUCED_MS / 1000 } : SPRING_FLIP;
  if (reveal || back === undefined) {
    return (
      <motion.div
        className={className}
        style={{ transformPerspective: 720, ...style }}
        initial={reduce ? false : { rotateY: 75, y: -22, opacity: 0.25 }}
        animate={{ rotateY: 0, y: 0, opacity: 1 }}
        transition={transition}
        data-testid={testid}
      >
        {front}
      </motion.div>
    );
  }
  return (
    <div className={className} style={{ perspective: 720, ...style }} data-testid={testid}>
      <motion.div
        className="flip-stage"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={transition}
      >
        <div className="flip-face flip-face--front">{front}</div>
        <div className="flip-face flip-face--back">{back}</div>
      </motion.div>
    </div>
  );
}
