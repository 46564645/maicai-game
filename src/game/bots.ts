/**
 * bots.ts —— 电脑玩家：chooseBotCommand(state, playerId) 纯函数。
 * 三种性格是策略表（不是搜索）：稳稳型/心动型/跟跟型；
 * 规则优先，平局用稳定哈希定序——同种子整局完全可复现。
 * 引擎不含定时器，动作间隔由 UI 负责。
 */
import { cards, getIngredient } from '../data/cards';
import { hash01 } from './rng';
import { availableCommands, missingCost } from './selectors';
import * as S from './stations/shared';
import type { BotPersonality, CardId, Command, GameState, Player, PlayerId } from './types';

/** 性格策略表【待试玩】：数值为 0..1 倾向，可在演示条切性格后生效 */
export interface BotStrategy {
  buyTemptation: number; // 买诱惑品的倾向
  holdTemptation: number; // 把诱惑品放进「先等等」的倾向
  buyExtraIngredient: number; // 买非菜谱材料的倾向
  spendOnEvent: number; // 事件选花钱方案的倾向
  useParentWhenNeedy: number; // 缺钱时找 AI 家长的概率
  acceptInvite: number; // 接受一起买的概率
  acceptSwapNeutral: number; // 无利可图也接受换菜的概率
  proposeSwapAny: number; // 换自己不需要的卡也乐意提议的概率（小跟最爱换，M4.5.4 降门槛）
  settleOne: number; // 家长站①②后拿 1 币走人的倾向
}

export const BOT_STRATEGIES: Record<BotPersonality, BotStrategy> = {
  steady: {
    buyTemptation: 0.05,
    holdTemptation: 0.1,
    buyExtraIngredient: 0,
    spendOnEvent: 0.15,
    useParentWhenNeedy: 0.95,
    acceptInvite: 0.15,
    acceptSwapNeutral: 0.1,
    proposeSwapAny: 0.15,
    settleOne: 0.75,
  },
  impulsive: {
    buyTemptation: 0.8,
    holdTemptation: 0.75,
    buyExtraIngredient: 0.35,
    spendOnEvent: 0.75,
    useParentWhenNeedy: 0.95,
    acceptInvite: 0.65,
    acceptSwapNeutral: 0.3,
    proposeSwapAny: 0.45,
    settleOne: 0.1,
  },
  follower: {
    buyTemptation: 0.3,
    holdTemptation: 0.35,
    buyExtraIngredient: 0.1,
    spendOnEvent: 0.4,
    useParentWhenNeedy: 0.85,
    acceptInvite: 0.9,
    acceptSwapNeutral: 0.65,
    proposeSwapAny: 0.85,
    settleOne: 0.4,
  },
};

type Roll = (salt: string) => number;

function makeRoll(state: GameState, playerId: PlayerId): Roll {
  return (salt) =>
    hash01(state.rng.seed, playerId, state.lap, state.stationIndex, state.log.length, salt);
}

function pick<T extends Command>(cmds: T[], roll: number): T {
  return cmds[Math.floor(roll * cmds.length) % cmds.length];
}

function botMarket(state: GameState, me: Player, cmds: Command[], roll: Roll): Command {
  const strat = BOT_STRATEGIES[me.personality ?? 'steady'];
  const missing = S.missingIngredients(me);
  const buys = cmds.filter((c) => c.type === 'STALL_BUY') as { type: 'STALL_BUY'; cardId: CardId }[];

  // 1. 先买菜谱还缺的材料
  const needed = buys.filter((c) => missing.includes(c.cardId));
  if (needed.length > 0) return pick(needed, roll('need'));

  // 2. 诱惑品：跟跟型看到别人买过更想买
  const tmpBuys = buys.filter((c) => S.isTemptation(c.cardId));
  const peerHas = state.players.some((q) => q.id !== me.id && q.temptations.length > 0);
  const tmpChance =
    me.personality === 'follower' && peerHas ? 0.9 : strat.buyTemptation;
  if (tmpBuys.length > 0 && roll('tmp') < tmpChance) return pick(tmpBuys, roll('tmp-i'));

  // 3. 多余的材料（攒交换用的赠品菜）
  const extraIng = buys.filter((c) => !S.isTemptation(c.cardId));
  if (extraIng.length > 0 && roll('extra') < strat.buyExtraIngredient) {
    return pick(extraIng, roll('extra-i'));
  }

  // 4. 「先等等」：优先夹买不起的所需材料，再按性格夹诱惑品
  const holds = cmds.filter((c) => c.type === 'STALL_HOLD') as {
    type: 'STALL_HOLD';
    cardId: CardId;
  }[];
  if (holds.length > 0 && me.holdClip === null) {
    const needHold = holds.filter(
      (c) => missing.includes(c.cardId) && (S.marketPriceOf(c.cardId) ?? 0) > me.coins,
    );
    if (needHold.length > 0) return pick(needHold, roll('hold-need'));
    const tmpHolds = holds.filter((c) => S.isTemptation(c.cardId));
    if (tmpHolds.length > 0 && roll('hold') < strat.holdTemptation) {
      return pick(tmpHolds, roll('hold-i'));
    }
  }
  return { type: 'END_TURN' };
}

/** 找一笔交换提议；没有就 END_TURN（不编造命令）。
 *  第一遍（旧逻辑）：只换自己还缺的材料（互利优先）。
 *  第二遍（M4.5.4 降门槛，addendum DECIDED a）：按性格 `proposeSwapAny` 提议——
 *  换自己不需要的卡也愿意，优先把对方缺的卡送出去（帮到伙伴），小跟最爱换。
 *  仍是一换一、不动币；真人优先，每站至多 1 个 bot→真人提议（引擎 humanOffered）。 */
function botPartner(state: GameState, me: Player, roll: Roll): Command {
  const sub = state.turn!.sub;
  if (sub.kind !== 'partner' || me.extras.length === 0) return { type: 'END_TURN' };
  const missing = S.missingIngredients(me);
  const strat = BOT_STRATEGIES[me.personality ?? 'steady'];

  const targets = [...state.players.filter((p) => p.id !== me.id)].sort(
    (a, b) => Number(b.isHuman) - Number(a.isHuman), // 真人优先（bot 主动向真人提议）
  );
  const propose = (
    target: Player,
    give: CardId,
    want: CardId,
  ): Command => ({ type: 'PROPOSE_SWAP', to: target.id, giveCardId: give, wantCardId: want });
  const seen = (target: Player, give: CardId, want: CardId) =>
    sub.declinedSwaps.includes(`${me.id}>${target.id}:${give}>${want}`);

  // 第一遍：换到自己缺的
  if (missing.length > 0) {
    for (const target of targets) {
      if (target.isHuman && (me.isHuman || sub.humanOffered)) continue;
      const tNeed = S.missingIngredients(target);
      for (const want of target.extras) {
        if (!missing.includes(want)) continue;
        // 先找对方也需要的（互利），再找任意赠品
        const gives = [
          ...me.extras.filter((g) => tNeed.includes(g)),
          ...me.extras.filter((g) => !tNeed.includes(g)),
        ];
        for (const give of gives) {
          if (seen(target, give, want)) continue;
          return propose(target, give, want);
        }
      }
    }
  }

  // 第二遍：按性格乐意换（不需要也提）——优先把对方缺的卡给出去
  if (roll('swap-any') < strat.proposeSwapAny) {
    for (const target of targets) {
      if (target.isHuman && (me.isHuman || sub.humanOffered)) continue;
      if (target.extras.length === 0) continue;
      const tNeed = S.missingIngredients(target);
      const gives = [
        ...me.extras.filter((g) => tNeed.includes(g)),
        ...me.extras.filter((g) => !tNeed.includes(g)),
      ];
      for (const give of gives) {
        for (const want of target.extras) {
          if (seen(target, give, want)) continue;
          return propose(target, give, want);
        }
      }
    }
  }
  return { type: 'END_TURN' };
}

function botStore(me: Player, cmds: Command[], roll: Roll): Command {
  const strat = BOT_STRATEGIES[me.personality ?? 'steady'];
  const missing = S.missingIngredients(me);
  const buys = cmds.filter(
    (c) => c.type === 'STORE_BUY' && missing.includes(c.ingredientId),
  ) as { type: 'STORE_BUY'; ingredientId: CardId }[];
  if (buys.length > 0) {
    buys.sort(
      (a, b) => (getIngredient(a.ingredientId)?.marketPrice ?? 0) - (getIngredient(b.ingredientId)?.marketPrice ?? 0),
    );
    return buys[0];
  }
  if (me.holdClip !== null) {
    const clip = me.holdClip;
    const price = S.marketPriceOf(clip);
    const wantIt =
      missing.includes(clip) ||
      (S.isTemptation(clip) && roll('clip') < strat.buyTemptation);
    const canBuy = cmds.some((c) => c.type === 'RESOLVE_HOLD' && c.buy);
    if (wantIt && canBuy) return { type: 'RESOLVE_HOLD', buy: true };
    if (price !== null && missing.includes(clip) && me.coins < price) {
      return { type: 'END_TURN' }; // 需要的买不起，留着下次再说
    }
    return { type: 'RESOLVE_HOLD', buy: false };
  }
  return { type: 'END_TURN' };
}

export function chooseBotCommand(state: GameState, playerId: PlayerId): Command {
  const cmds = availableCommands(state);
  if (cmds.length === 0) return { type: 'ACK' };
  const me = S.getPlayer(state, playerId);
  const strat = BOT_STRATEGIES[me.personality ?? 'steady'];
  const roll = makeRoll(state, playerId);
  const pd = state.pendingDecision;

  switch (pd.kind) {
    case 'marketTurn':
      return botMarket(state, me, cmds, roll);

    case 'inviteResponse': {
      const accept = cmds.find((c) => c.type === 'RESPOND_INVITE' && c.accept);
      if (accept && roll('invite') < strat.acceptInvite) return accept;
      return cmds.find((c) => c.type === 'RESPOND_INVITE' && !c.accept) ?? cmds[0];
    }

    case 'proposeSwap':
      return botPartner(state, me, roll);

    case 'eventOption': {
      const spend = cmds.find((c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'spend');
      if (spend) {
        const sub = state.turn?.sub;
        const card =
          sub?.kind === 'event' ? cards.events.find((e) => e.id === sub.eventCardId) : undefined;
        const gainNeeded =
          card?.spendOption.effect?.gainIngredientId !== undefined &&
          S.missingIngredients(me).includes(card.spendOption.effect.gainIngredientId);
        if (gainNeeded || roll('event') < strat.spendOnEvent) return spend;
      }
      return cmds.find((c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'free') ?? cmds[0];
    }

    case 'parentUse': {
      const needy = me.coins < missingCost(me) + me.busDebt;
      const use = needy
        ? roll('parent') < strat.useParentWhenNeedy
        : me.personality === 'impulsive' && roll('parent-free') < 0.3;
      return (
        cmds.find((c) => c.type === (use ? 'PARENT_BEGIN' : 'PARENT_SKIP')) ?? cmds[0]
      );
    }

    case 'parentAnswer': {
      const q = cards.parentStation.questions[pd.step];
      const good = (q?.options ?? []).filter((o) => !o.tags.includes('unclear'));
      const opt = good[Math.floor(roll(`pa-${pd.step}`) * good.length) % Math.max(good.length, 1)];
      if (opt) return { type: 'PARENT_ANSWER', answer: { mode: 'card', optionId: opt.id } };
      return cmds[0];
    }

    case 'parentSettle':
      return roll('settle') < strat.settleOne ? { type: 'PARENT_SETTLE' } : { type: 'ACK' };

    case 'storeTurn':
      return botStore(me, cmds, roll);

    case 'reflection':
      return pick(cmds, roll('reflection'));

    default:
      return cmds[0];
  }
}

