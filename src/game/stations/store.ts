/**
 * store.ts —— 07 小卖部补买。
 * 只卖材料、无限供应，每样 = 市场价 + markup（默认 +1）；「先等等」夹在此
 * 站（以及菜市场）可按原价买下或放弃（放弃即移出）。
 */
import { getIngredient } from '../../data/cards';
import { gameConfig } from '../../config/gameConfig';
import { strings } from '../../data/strings';
import type { CardId, GameState } from '../types';
import * as S from './shared';
import type { Outcome } from './shared';

export function storeBuy(state: GameState, ingredientId: CardId): Outcome {
  const turn = state.turn;
  const actor = S.currentActorId(state);
  if (!actor || !turn || turn.sub.kind !== 'store') return S.bad('ERR_PHASE');
  const sub = turn.sub;
  // 小卖部无限供应：一次到站同一样材料只补一次，免得连点两下多买一份
  if (sub.boughtIds.includes(ingredientId)) return S.bad('ERR_LIMIT');
  const ing = getIngredient(ingredientId);
  if (!ing) return S.bad('ERR_NO_CARD');
  const p = S.getPlayer(state, actor);
  const cost = ing.marketPrice + gameConfig.store.markup;
  if (p.coins < cost) return S.bad('ERR_NO_COINS');
  let s = S.updatePlayer(state, actor, (x) => ({ ...x, coins: x.coins - cost }));
  s = S.grantCard(s, actor, ingredientId);
  s = {
    ...s,
    turn: {
      ...s.turn!,
      sub: { ...sub, boughtIds: [...sub.boughtIds, ingredientId] },
    },
  };
  s = S.logWith(s, strings.log.storeBought, { name: p.name, item: ing.name }, actor, {
    kind: 'ingredient',
    coins: cost,
  });
  return S.ok(s);
}

/** 「先等等」夹结算：buy=按原价买 / 放弃；菜市场与小卖部通用 */
export function resolveHold(state: GameState, buy: boolean): Outcome {
  const actor = S.currentActorId(state);
  if (!actor) return S.bad('ERR_PHASE');
  const p = S.getPlayer(state, actor);
  const clip = p.holdClip;
  if (clip === null) return S.bad('ERR_NO_CARD');
  let s = state;
  if (buy) {
    const price = S.marketPriceOf(clip); // 保留原价，不加价
    if (price === null) return S.bad('ERR_NO_CARD');
    if (p.coins < price) return S.bad('ERR_NO_COINS');
    s = S.updatePlayer(s, actor, (x) => ({ ...x, coins: x.coins - price, holdClip: null }));
    s = S.grantCard(s, actor, clip);
    s = S.logWith(s, strings.log.holdBought, { name: p.name, item: S.cardName(clip) }, actor, {
      kind: S.spendKindOf(clip),
      coins: price,
    });
  } else {
    s = S.updatePlayer(s, actor, (x) => ({ ...x, holdClip: null }));
    s = S.logWith(s, strings.log.holdDropped, { name: p.name, item: S.cardName(clip) }, actor);
  }
  if (s.turn?.sub.kind === 'store') {
    s = { ...s, turn: { ...s.turn, sub: { ...s.turn.sub, holdResolved: true } } };
  }
  return S.ok(s);
}
