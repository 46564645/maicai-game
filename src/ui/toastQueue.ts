/**
 * toastQueue.ts —— 提示条排队/合并的纯逻辑（无 React、无 DOM，单测直接跑）。
 *
 * 口径（toast-4s）：
 * - 提示条排队：同屏只有一条，新日志按到达顺序排在队尾，前一条
 *   4s dwell 结束（或被点掉）后下一条接上，绝不叠条。
 * - 连续的 bot 动作条合并成一条组合行（如「Mao 买了黄瓜 · Zip 投币
 *   2 枚」），不拆成一长串逐条轮播；合并以「队尾条」为目标——队尾
 *   可合并且未合并满就吃进去，正在显示的那条被并入新内容时 rev+1
 *   （组件据此重计 4s，新合并进来的文字保证读满一个 dwell）。
 * - 真人动作与系统条（无 playerId / asAi 家长台词）不合并，各站一条。
 */
import type { LogEntry, PlayerId } from '../game/types';

/** 队列中一条待播提示（key=首条日志 id；texts 为引擎原文，渲染层本地化） */
export interface ToastItem {
  key: number;
  /** 合并修订号：可见条被并入新日志时 +1，组件据 key+rev 重计 dwell */
  rev: number;
  texts: string[];
  /** true = bot 动作条，可继续吃后续连续的 bot 动作 */
  mergeable: boolean;
  /** true = UI 直给的说明条（如类别记号首访说明）：texts 已是当前
   *  语言成品，渲染时不再走日志文本本地化 */
  raw?: boolean;
}

/** 一条组合行最多合并几条 bot 动作（防一长串不可读），再来的开新条排队 */
export const TOAST_MERGE_MAX = 4;

/** bot 动作日志：有主玩家且非真人、非 AI 家长台词（asAi 走对话气泡，独占一条） */
export function isBotActionEntry(e: LogEntry, humanId?: PlayerId): boolean {
  return e.playerId !== undefined && e.playerId !== humanId && e.asAi !== true;
}

export function makeToastItem(e: LogEntry, humanId?: PlayerId): ToastItem {
  return {
    key: e.id,
    rev: 0,
    texts: [e.text],
    mergeable: isBotActionEntry(e, humanId),
  };
}

/**
 * 把新到的日志按序并入队列（返回新数组，不改入参）：
 * - 新日志是 bot 动作且队尾条可合并、未合并满 → 并入队尾（rev+1）；
 * - 否则各占一条排在队尾。
 */
export function enqueueToastEntries(
  items: readonly ToastItem[],
  fresh: readonly LogEntry[],
  humanId?: PlayerId,
): ToastItem[] {
  let out = items.slice();
  for (const e of fresh) {
    const tail = out[out.length - 1];
    if (
      tail &&
      tail.mergeable &&
      tail.texts.length < TOAST_MERGE_MAX &&
      isBotActionEntry(e, humanId)
    ) {
      out = [
        ...out.slice(0, -1),
        { ...tail, rev: tail.rev + 1, texts: [...tail.texts, e.text] },
      ];
    } else {
      out = [...out, makeToastItem(e, humanId)];
    }
  }
  return out;
}
