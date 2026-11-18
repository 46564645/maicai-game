/**
 * reflectionPick.ts —— R10C（education runner-up）反思选项个性化：
 * 从孩子自己这一局的账本（log + collected）推「她真做过的事」，把
 * 对应的预设选项排前并盖「做到了」小标——让 6–12 岁孩子挑一件
 * 今天真发生过的决定来说，而不是对着五条抽象话术发呆。
 * 纯派生数据展示：选项集合仍是 cards.json 的 rho-*，命令不变。
 */
import { getRecipe } from '../data/cards';
import { strings } from '../data/strings';
import type { GameState, Player } from '../game/types';

/** 每个预设反思选项 ↔ 「她今天做到了吗」的账本判定 */
export function reflectionDone(state: GameState, me: Player): Record<string, boolean> {
  const mine = state.log.filter((e) => e.playerId === me.id);
  const recipe = me.recipeId ? getRecipe(me.recipeId) : null;
  const recipeDone =
    recipe != null && recipe.ingredientIds.every((id) => me.collected.includes(id));
  // 「换了菜」模板后半段做 includes 判定（中英双语安全，随当前字典走）
  const swapFrag = strings.log.swapDone.split('{item}')[1];
  return {
    'rho-1': recipeDone, // 买齐了菜谱的菜
    'rho-2': !mine.some((e) => e.spend?.kind === 'temptation'), // 一份诱惑品都没买
    'rho-3': !!swapFrag && mine.some((e) => e.text.includes(swapFrag)), // 换过菜
    'rho-4': mine.some((e) => e.spend?.kind === 'bus'), // 付过/记过车费
    'rho-5': mine.some((e) => e.asAi === true), // 跟家长说过自己的打算
  };
}

/** 把预设选项按「做到了」提前（稳定排序）；返回 id→done 供打卡面小标 */
export function orderOptions<T extends { id: string }>(
  options: T[],
  done: Record<string, boolean>,
): T[] {
  return [...options].sort((a, b) => Number(done[b.id] ?? false) - Number(done[a.id] ?? false));
}
