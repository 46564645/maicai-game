/**
 * stations/shared.ts —— 站点共用工具（纯函数，禁 import React）。
 * 规则判断都放引擎层；组件只做展示。
 */
import { cards, getIngredient, getRecipe } from '../../data/cards';
import { gameConfig } from '../../config/gameConfig';
import { strings } from '../../data/strings';
import type {
  CardId,
  EngineError,
  GameState,
  PendingDecision,
  Player,
  PlayerId,
  SpendKind,
  StationId,
  StationSub,
} from '../types';

/** 站点命令处理结果：成功给新状态（done=true 表示该玩家回合结束），失败给错误码 */
export type Outcome = { state: GameState; done?: boolean } | { error: EngineError };
export const ok = (state: GameState, done = false): Outcome => ({ state, done });
export const bad = (error: EngineError): Outcome => ({ error });

/* —— 玩家读写 —— */

export function getPlayer(state: GameState, id: PlayerId): Player {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`); // 引擎内部保证 id 合法
  return p;
}

export function updatePlayer(
  state: GameState,
  id: PlayerId,
  fn: (p: Player) => Player,
): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? fn(p) : p)) };
}

/* —— 日志 —— */

export function fmt(tpl: string, vars: Record<string, string | number>): string {
  return tpl
    .replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`))
    .replace(/\b1 coins\b/g, '1 coin'); // 英文单复数：模板统一写 "{n} coins"
}

export function pushLog(
  state: GameState,
  text: string,
  playerId?: PlayerId,
  spend?: { kind: SpendKind; coins: number },
  asAi?: boolean,
): GameState {
  return {
    ...state,
    log: [...state.log, { id: state.log.length, text, playerId, lap: state.lap, spend, asAi }],
  };
}

export function logWith(
  state: GameState,
  tpl: string,
  vars: Record<string, string | number>,
  playerId?: PlayerId,
  spend?: { kind: SpendKind; coins: number },
  asAi?: boolean,
): GameState {
  return pushLog(state, fmt(tpl, vars), playerId, spend, asAi);
}

/* —— 站点与座位 —— */

export function stationId(state: GameState): StationId {
  return gameConfig.stations[state.stationIndex].id;
}

/** 本站行动顺序：座位序左旋 offset，保证相邻两站起始人不同（PLAN §5 歧义 4） */
export function stationOrder(lap: number, stationIndex: number): PlayerId[] {
  const n = gameConfig.playerCount;
  const seats = Array.from({ length: n }, (_, i) => `p${i}`);
  const offset = ((lap - 1) * gameConfig.stations.length + stationIndex) % n;
  return [...seats.slice(offset), ...seats.slice(0, offset)];
}

export function initialSub(id: StationId): StationSub {
  switch (id) {
    case 'drawTask':
      return { kind: 'drawTask' };
    case 'market':
      return {
        kind: 'market',
        buysLeft: gameConfig.market.maxBuyPerVisit,
        holdUsed: false,
        boughtIds: [],
      };
    case 'partner':
      return {
        kind: 'partner',
        inviteCardId: null,
        inviteAccepted: [],
        inviteResponded: [],
        humanOffered: false,
        declinedSwaps: [],
      };
    case 'bus':
      return { kind: 'bus' };
    case 'event':
      return { kind: 'event', weatherId: null, eventCardId: null };
    case 'parent':
      return { kind: 'parent' };
    case 'store':
      return { kind: 'store', holdResolved: false, boughtIds: [] };
    case 'cook':
      return { kind: 'cook' };
  }
}

export function currentActorId(state: GameState): PlayerId | null {
  const t = state.turn;
  if (!t || t.turnPhase !== 'act') return null;
  return t.order[t.orderIndex] ?? null;
}

/* —— 卡牌与菜谱 —— */

export function isTemptation(cardId: CardId): boolean {
  return cards.temptations.some((t) => t.id === cardId);
}

/** 卡的「原价」：材料取市场价，诱惑品取标价 */
export function marketPriceOf(cardId: CardId): number | null {
  const ing = getIngredient(cardId);
  if (ing) return ing.marketPrice;
  const tmp = cards.temptations.find((t) => t.id === cardId);
  if (tmp) return tmp.price;
  return null;
}

export function cardName(cardId: CardId): string {
  return (
    getIngredient(cardId)?.name ??
    cards.temptations.find((t) => t.id === cardId)?.name ??
    cards.recipes.find((r) => r.id === cardId)?.name ??
    cards.weather.find((w) => w.id === cardId)?.name ??
    cards.events.find((e) => e.id === cardId)?.name ??
    cards.invites.find((i) => i.id === cardId)?.name ??
    cardId
  );
}

/** 菜谱还缺的材料 */
export function missingIngredients(p: Player): CardId[] {
  const recipe = p.recipeId ? getRecipe(p.recipeId) : undefined;
  if (!recipe) return [];
  const have = new Set(p.collected);
  return recipe.ingredientIds.filter((id) => !have.has(id));
}

/**
 * 卡进篮子：菜谱还缺的材料→collected；其它材料→extras 赠品菜（可交换）；
 * 诱惑品→temptations。
 */
export function grantCard(state: GameState, playerId: PlayerId, cardId: CardId): GameState {
  const p = getPlayer(state, playerId);
  if (isTemptation(cardId)) {
    return updatePlayer(state, playerId, (x) => ({ ...x, temptations: [...x.temptations, cardId] }));
  }
  if (missingIngredients(p).includes(cardId)) {
    return updatePlayer(state, playerId, (x) => ({ ...x, collected: [...x.collected, cardId] }));
  }
  return updatePlayer(state, playerId, (x) => ({ ...x, extras: [...x.extras, cardId] }));
}

/* —— 币 —— */

/** 卡的花钱去向分类（G6 流水用）：材料=菜，诱惑品=诱惑 */
export function spendKindOf(cardId: CardId): SpendKind {
  return isTemptation(cardId) ? 'temptation' : 'ingredient';
}

/** 得币统一入口：先自动补待付夹车费，剩下的才进钱包（REQUIREMENTS §5.04） */
export function gainCoins(state: GameState, playerId: PlayerId, n: number): GameState {
  if (n <= 0) return state;
  const p = getPlayer(state, playerId);
  const repay = Math.min(n, p.busDebt);
  let s = state;
  if (repay > 0) {
    s = updatePlayer(s, playerId, (x) => ({ ...x, busDebt: x.busDebt - repay }));
    s = logWith(s, strings.log.debtPaid, { name: p.name, n: repay }, playerId, {
      kind: 'bus',
      coins: repay,
    });
  }
  return updatePlayer(s, playerId, (x) => ({ ...x, coins: x.coins + (n - repay) }));
}

/* —— pendingDecision 计算（引擎每次命令后统一调用）—— */

export function inviteProposalId(state: GameState, actor: PlayerId): string {
  return `inv-${state.lap}-${state.stationIndex}-${actor}`;
}

export function computePending(state: GameState): PendingDecision {
  if (state.phase !== 'station') {
    if (state.phase === 'basket' || state.phase === 'feast') {
      return { kind: 'ack', playerId: state.humanId };
    }
    if (state.phase === 'reflection') {
      const done = new Set(state.reflections.map((r) => r.playerId));
      const next = state.players.find((p) => !done.has(p.id));
      return next ? { kind: 'reflection', playerId: next.id } : { kind: 'none' };
    }
    return { kind: 'none' };
  }
  const turn = state.turn;
  if (!turn || turn.turnPhase === 'done') return { kind: 'none' };
  if (turn.turnPhase === 'intro') return { kind: 'ack', playerId: turn.order[0] };

  // 发给真人的提议优先于一切（阻断 bot 推进）
  const prop = state.proposals.find((p) => p.to === state.humanId);
  if (prop) {
    return prop.kind === 'swap'
      ? { kind: 'swapResponse', proposalId: prop.id, playerId: prop.to }
      : { kind: 'inviteResponse', proposalId: prop.id, playerId: prop.to };
  }

  const actor = turn.order[turn.orderIndex];
  if (!actor) return { kind: 'none' };
  const sub = turn.sub;
  switch (sub.kind) {
    case 'drawTask': {
      const p = getPlayer(state, actor);
      return state.lap === 1 && p.recipeId === null
        ? { kind: 'drawRecipe', playerId: actor }
        : { kind: 'ack', playerId: actor };
    }
    case 'market':
      return { kind: 'marketTurn', playerId: actor };
    case 'partner':
      return sub.inviteResponded.includes(actor)
        ? { kind: 'proposeSwap', playerId: actor }
        : { kind: 'inviteResponse', proposalId: inviteProposalId(state, actor), playerId: actor };
    case 'bus':
      return { kind: 'payBus', playerId: actor };
    case 'event':
      return { kind: 'eventOption', playerId: actor };
    case 'parent': {
      const d = state.parentDialog;
      if (!d || d.playerId !== actor) return { kind: 'parentUse', playerId: actor };
      return d.offerSettle
        ? { kind: 'parentSettle', playerId: actor }
        : { kind: 'parentAnswer', playerId: actor, step: d.step };
    }
    case 'store':
      return { kind: 'storeTurn', playerId: actor };
    case 'cook':
      return { kind: 'ack', playerId: actor };
  }
}
