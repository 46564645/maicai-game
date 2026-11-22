/**
 * DeltaChip.tsx —— 金币增减小片的 WS5 motion 实现（本仓自写，非第三方
 * 登记项；芯片样式本体仍是 .coin-delta-chip，WS3-C5 接走重做）。
 *
 * F26 → Animated Content「rise」族：+n/−n 从宿主右上角短距升起 + 淡入，
 * 停一拍后升出淡出（与旧 coin-delta-rise keyframe 同轨迹 1.1s）。
 * 由宿主按 stamp 作 key 挂载——一片一次生命，卸载交给宿主计时器。
 * reduced-motion：不升不位移，静态停驻 55% 后淡出（旧降级档同口径）。
 */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export function DeltaChip({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="coin-delta-chip"
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={
        reduce
          ? { opacity: [1, 1, 0] }
          : { opacity: [0, 1, 1, 0], y: [4, 0, -8, -13] }
      }
      transition={
        reduce
          ? { duration: 1.1, times: [0, 0.55, 1], ease: 'easeOut' }
          : { duration: 1.1, times: [0, 0.15, 0.55, 1], ease: 'easeOut' }
      }
    >
      {children}
    </motion.span>
  );
}
