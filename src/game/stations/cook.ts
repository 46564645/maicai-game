/**
 * cook.ts —— 08 回家一起做饭。
 * 第 1、2 圈：把已有材料放进盘子位（写日志），随后进「我的篮子」；
 * 第 3 圈由 engine 结算 plates 进 feast。
 */
import { strings } from '../../data/strings';
import type { GameState } from '../types';
import * as S from './shared';

export function cookAck(state: GameState): GameState {
  const actor = S.currentActorId(state);
  if (!actor) return state;
  const p = S.getPlayer(state, actor);
  return S.logWith(state, strings.log.cooked, { name: p.name }, actor);
}
