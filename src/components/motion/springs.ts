/**
 * springs.ts —— 全项目共享弹簧参数（React Bits Magnet 口径，WS5 动效基座）。
 *
 * 与 useDragPlay 弹回（420ms / --ease-spring ≈ cubic-bezier(0.34,1.56,0.64,1)）
 * 同一手感：慢、稳、轻微回弹即收，绝不过冲炫技。所有 motion 驱动的
 * 入场/弹出/飞行/拖拽效果一律取这里的参数，各流（WS1–WS4/WS6）不要再造。
 *
 * reduced-motion 不在此处理——由调用方（AnimatedContent/FadeContent 或
 * useReducedMotion）决定直渲终态还是缩短到 120ms。
 */
import type { Transition } from 'motion/react';

/** 小物件弹入（手牌新卡、心里话气泡、金币点）：中硬度 + 温和回弹 */
export const SPRING_POP: Transition = {
  type: 'spring',
  stiffness: 170,
  damping: 18,
};

/** 大元素落位（弹窗、大卡、故事卡、盘卡）：更软更慢，沉降感 */
export const SPRING_SETTLE: Transition = {
  type: 'spring',
  stiffness: 110,
  damping: 17,
};

/** 拖拽反馈（投放区确认弹、拒收拽引）：快而稳，几乎不回弹 */
export const SPRING_SNAP: Transition = {
  type: 'spring',
  stiffness: 340,
  damping: 26,
};

/** 飞卡到目标（答案卡飞聊天区、食材飞锅）：spring-to-target + 落定 */
export const SPRING_FLIGHT: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 28,
};

/** 翻面（FlipCard / 牌堆顶卡）：约 560ms 的翻牌手感 */
export const SPRING_FLIP: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 24,
};

/** reduced-motion 用的收一档时长：120ms（与旧降级档同值） */
export const REDUCED_MS = 120;
