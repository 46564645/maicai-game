/**
 * nextActor.ts —— R10 Slice D（UI #8）：回合序里「下一个轮到谁」。
 * 纯读 state.turn：intro 阶段 = order[0]（马上要行动的）；act 阶段 =
 * order[orderIndex+1]（当前那位之后）；无下一位/不在站内 → null。
 * 供 HUD 回合条高亮「下一位」用——presentation only，不预测命令。
 */
import type { GameState, PlayerId } from '../game/types';

export function nextActorId(state: GameState): PlayerId | null {
  const turn = state.turn;
  if (!turn || turn.order.length === 0) return null;
  if (turn.turnPhase === 'intro') return turn.order[0] ?? null;
  if (turn.turnPhase === 'act') return turn.order[turn.orderIndex + 1] ?? null;
  return null;
}
