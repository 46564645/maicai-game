/**
 * botTiming.ts —— R1-E3：bot 回合总预算（纯函数，驱动层 useBotDriver 专用）。
 *
 * 背景：旧节奏每条命令固定 botDelayMs(800)，bot 一回合 3–5 条命令
 * = 2.4–4.0s，孩子干等。E3 口径：每台 bot 每回合平均 ≤2s。
 * 算法（阶梯递减，只动呈现时序，不动引擎命令与顺序）：
 *   第 1 条命令：base（800ms）——留一拍让孩子看清「轮到谁、要干什么」
 *   第 2–4 条：  250ms——动作连贯起来，不再逐条等
 *   第 5 条起：  120ms——长回合（如市场连买）尾段近似连发
 * 典型回合总时长（base=800）：3 条 1300ms / 4 条 1550ms / 5 条 1670ms，
 * 均 ≤2s 预算；连 8 条也只 2030ms 上下，不会失控。
 * ?fast=1 的 0 延迟不走本表（驱动层直接用 fastDelayMs）。
 */

/** E3 预算：单个 bot 回合总时长上限（平均口径） */
export const BOT_TURN_BUDGET_MS = 2000;

/** 本回合第 stepIndex 条命令（0 起）的驱动延迟 */
export function botCommandDelayMs(stepIndex: number, baseMs: number): number {
  if (stepIndex <= 0) return baseMs;
  if (stepIndex <= 3) return 250;
  return 120;
}

/** 一个回合 commandCount 条命令的总驱动时长（量测/测试口径） */
export function botTurnTotalMs(commandCount: number, baseMs: number): number {
  let total = 0;
  for (let i = 0; i < commandCount; i++) total += botCommandDelayMs(i, baseMs);
  return total;
}

/** R1-E3 快进入口事件名：点当前 bot 的角落小卡 → 驱动层清零本回合剩余延迟 */
export const BOT_FAST_FORWARD_EVENT = 'maicai:bot-ff';

/** 发快进信号（驱动层 useBotDriver 监听；无 window 环境静默） */
export function fastForwardBotTurn(playerId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BOT_FAST_FORWARD_EVENT, { detail: { playerId } }),
  );
}
