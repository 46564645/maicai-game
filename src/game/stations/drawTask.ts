/**
 * drawTask.ts —— 01 抽任务卡。
 * 第 1 圈抽菜谱（不放回）；第 2、3 圈只「看一眼」，由 engine 用 ACK 推进。
 */
import { getRecipe } from '../../data/cards';
import { strings } from '../../data/strings';
import type { GameState } from '../types';
import * as S from './shared';
import type { Outcome } from './shared';

export function drawRecipe(state: GameState): Outcome {
  const actor = S.currentActorId(state);
  if (!actor) return S.bad('ERR_PHASE');
  const rid = state.recipeDeck[0];
  const recipe = rid ? getRecipe(rid) : undefined;
  if (!rid || !recipe) return S.bad('ERR_NO_CARD');
  let s: GameState = { ...state, recipeDeck: state.recipeDeck.slice(1) };
  s = S.updatePlayer(s, actor, (p) => ({ ...p, recipeId: rid }));
  s = S.logWith(
    s,
    strings.log.drewRecipe,
    { name: S.getPlayer(s, actor).name, item: recipe.name },
    actor,
  );
  return S.ok(s, true);
}
