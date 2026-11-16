/**
 * market.ts —— 02 菜市场摊位。
 * 规则：每次到站最多买 maxBuyPerVisit 张、先等等最多 maxHold 张；被买走
 * 的卡由牌堆补满 faceUp；每玩家回合保证摊位至少 minNeededGuarantee 张其
 * 所需材料（PLAN §5 歧义 5）；「先等等」夹在此站可原价结算。
 */
import { gameConfig } from '../../config/gameConfig';
import { nextInt } from '../rng';
import { strings } from '../../data/strings';
import type { CardId, GameState, PlayerId } from '../types';
import * as S from './shared';
import type { Outcome } from './shared';

function takeFromDeck(stall: (CardId | null)[], deck: CardId[], slot: number): void {
  stall[slot] = deck.shift() ?? null;
}

/** 玩家回合开始：保证摊位至少 minNeededGuarantee 张其所需材料（防卡死） */
export function ensureNeededOnStall(state: GameState, playerId: PlayerId): GameState {
  const needed = new Set(S.missingIngredients(S.getPlayer(state, playerId)));
  if (needed.size === 0) return state;
  let s = state;
  const count = () => s.market.stall.filter((id) => id !== null && needed.has(id)).length;
  let guard = 0;
  while (count() < gameConfig.market.minNeededGuarantee && guard++ < gameConfig.market.faceUp) {
    const di = s.market.deck.findIndex((id) => needed.has(id));
    if (di < 0) break;
    const slots = s.market.stall
      .map((id, i) => ({ id, i }))
      .filter((x) => x.id === null || !needed.has(x.id))
      .map((x) => x.i);
    if (slots.length === 0) break;
    const pick = nextInt(s.rng, slots.length);
    const stall = [...s.market.stall];
    const deck = [...s.market.deck];
    const incoming = deck.splice(di, 1)[0];
    const outgoing = stall[slots[pick.value]];
    stall[slots[pick.value]] = incoming;
    if (outgoing) deck.push(outgoing);
    s = { ...s, rng: pick.rng, market: { stall, deck } };
  }
  return s;
}

export function stallBuy(state: GameState, cardId: CardId): Outcome {
  const turn = state.turn;
  const actor = S.currentActorId(state);
  if (!turn || turn.sub.kind !== 'market' || !actor) return S.bad('ERR_PHASE');
  const sub = turn.sub;
  if (sub.buysLeft <= 0) return S.bad('ERR_LIMIT');
  // 摊位可能同时摆着两张同名食材（牌堆里每种 4 张）：一次到站同一样东西只买一次，
  // 免得孩子点同一张卡两下就多花一份钱、流水里也看不出是两笔
  if (sub.boughtIds.includes(cardId)) return S.bad('ERR_LIMIT');
  const slot = state.market.stall.indexOf(cardId);
  const price = S.marketPriceOf(cardId);
  if (slot < 0 || price === null) return S.bad('ERR_NO_CARD');
  const p = S.getPlayer(state, actor);
  if (p.coins < price) return S.bad('ERR_NO_COINS');

  let s = S.updatePlayer(state, actor, (x) => ({ ...x, coins: x.coins - price }));
  s = S.grantCard(s, actor, cardId);
  const stall = [...s.market.stall];
  const deck = [...s.market.deck];
  takeFromDeck(stall, deck, slot);
  s = {
    ...s,
    market: { stall, deck },
    turn: {
      ...s.turn!,
      sub: {
        ...sub,
        buysLeft: sub.buysLeft - 1,
        boughtIds: [...sub.boughtIds, cardId],
      },
    },
  };
  s = S.logWith(s, strings.log.bought, { name: p.name, item: S.cardName(cardId) }, actor, {
    kind: S.spendKindOf(cardId),
    coins: price,
  });
  return S.ok(s);
}

export function stallHold(state: GameState, cardId: CardId): Outcome {
  const turn = state.turn;
  const actor = S.currentActorId(state);
  if (!turn || turn.sub.kind !== 'market' || !actor) return S.bad('ERR_PHASE');
  const sub = turn.sub;
  const p = S.getPlayer(state, actor);
  if (sub.holdUsed || p.holdClip !== null) return S.bad('ERR_LIMIT');
  const slot = state.market.stall.indexOf(cardId);
  if (slot < 0) return S.bad('ERR_NO_CARD');

  let s = S.updatePlayer(state, actor, (x) => ({ ...x, holdClip: cardId }));
  const stall = [...s.market.stall];
  const deck = [...s.market.deck];
  takeFromDeck(stall, deck, slot);
  s = { ...s, market: { stall, deck }, turn: { ...s.turn!, sub: { ...sub, holdUsed: true } } };
  s = S.logWith(s, strings.log.held, { name: p.name, item: S.cardName(cardId) }, actor);
  return S.ok(s);
}
