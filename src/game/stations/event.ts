/**
 * event.ts —— 05 随机事件站。
 * 每玩家回合自己转一次天气、抽对应天气的 1 张事件卡（PLAN §5 歧义 8）。
 * ADAPTATION #2：晴天只抽好事卡，下雨/刮风抽「花钱/不花钱」两选项事件卡
 * （由 cards.json 的 weatherIds + isGood 数据保证）。花钱事件数达上限后只抽
 * 好事卡——若本天气下没有好事卡，跨天气回退到全部好事卡，保护不丢。
 * 钱不够时花钱方案不可选。
 */
import { cards } from '../../data/cards';
import type { EventEffect } from '../../data/cards';
import { gameConfig } from '../../config/gameConfig';
import { strings } from '../../data/strings';
import { nextInt } from '../rng';
import type { GameState, PlayerId } from '../types';
import * as S from './shared';
import type { Outcome } from './shared';

/** 回合开始：转天气 → 抽事件卡 */
export function spinEvent(state: GameState, actor: PlayerId): GameState {
  let rng = state.rng;
  const w = nextInt(rng, cards.weather.length);
  rng = w.rng;
  const weather = cards.weather[w.value];
  const p = S.getPlayer(state, actor);
  let pool = cards.events.filter((e) => e.weatherIds.includes(weather.id));
  if (p.paidEventCount >= gameConfig.events.maxPaidPerPlayer) {
    // 满 2 次后改抽好事卡；本天气没有好事卡时跨天气回退到全部好事卡（ADAPTATION #2）
    const good = pool.filter((e) => e.isGood);
    const goodPool = good.length > 0 ? good : cards.events.filter((e) => e.isGood);
    if (goodPool.length > 0) pool = goodPool;
  }
  if (pool.length === 0) pool = cards.events;
  const e = nextInt(rng, pool.length);
  rng = e.rng;
  const card = pool[e.value];
  let s: GameState = {
    ...state,
    rng,
    turn: {
      ...state.turn!,
      sub: { kind: 'event', weatherId: weather.id, eventCardId: card.id },
    },
  };
  s = S.logWith(
    s,
    strings.log.eventCard,
    { name: p.name, weather: weather.name, item: card.name },
    actor,
  );
  return s;
}

function applyEffect(state: GameState, playerId: PlayerId, effect?: EventEffect): GameState {
  let s = state;
  if (effect?.coinsDelta) s = S.gainCoins(s, playerId, effect.coinsDelta);
  if (effect?.gainIngredientId) {
    s = S.updatePlayer(s, playerId, (x) => ({
      ...x,
      extras: [...x.extras, effect.gainIngredientId!],
    }));
  }
  return s;
}

export function chooseEventOption(state: GameState, option: 'spend' | 'free'): Outcome {
  const turn = state.turn;
  const actor = S.currentActorId(state);
  if (!turn || turn.sub.kind !== 'event' || !actor) return S.bad('ERR_PHASE');
  const sub = turn.sub;
  const card = cards.events.find((e) => e.id === sub.eventCardId);
  if (!card) return S.bad('ERR_NO_CARD');
  const opt = option === 'spend' ? card.spendOption : card.freeOption;
  let s = state;
  const p = S.getPlayer(state, actor);
  if (option === 'spend') {
    if (p.paidEventCount >= gameConfig.events.maxPaidPerPlayer) return S.bad('ERR_LIMIT');
    const cost = opt.coins ?? 0;
    if (p.coins < cost) return S.bad('ERR_NO_COINS');
    s = S.updatePlayer(s, actor, (x) => ({
      ...x,
      coins: x.coins - cost,
      paidEventCount: x.paidEventCount + 1,
    }));
  }
  s = applyEffect(s, actor, opt.effect);
  const gain = opt.effect?.coinsDelta ?? 0;
  s = S.logWith(
    s,
    strings.log.eventChoice,
    { name: p.name, item: opt.label },
    actor,
    option === 'spend'
      ? { kind: 'event', coins: opt.coins ?? 0 }
      : gain > 0
        ? { kind: 'gain', coins: gain }
        : undefined,
  );
  return S.ok(s, true);
}
