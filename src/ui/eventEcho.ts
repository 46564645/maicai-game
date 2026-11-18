/**
 * eventEcho.ts —— R10 Slice D（education #7）：事件选择的后果回声。
 * 纯函数：输入「花了多少 / 花后还剩 / 菜谱还差多少钱」，决定面板在
 * 后悔窗口里播哪一条回声文案。三种结局：
 *   free     —— 选了免费项：一个币也没花
 *   spendOk  —— 花了币，买菜钱仍然够（菜谱缺口 = missingCost，市场价）
 *   spendGap —— 花进了菜谱缺口：提示还差多少
 * 文案本体在 i18n 字典（event.echo*），本文件只给分支判定。
 */
export type EventEchoKind = 'free' | 'spendOk' | 'spendGap';

export function eventEchoKind(
  spent: number,
  coinsAfter: number,
  missingCost: number,
): EventEchoKind {
  if (spent <= 0) return 'free';
  return coinsAfter >= missingCost ? 'spendOk' : 'spendGap';
}
