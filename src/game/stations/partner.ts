/**
 * partner.ts —— 03 伙伴站。
 * 规则：赠品菜一换一；邀请卡「一起买」各付各的份（不代付），凑够 minPlayers
 * 才各自扣币拿卡，没凑够退款；引擎层面禁止任何玩家之间的币转移。
 * bot→真人提议进 proposals 等回应；bot↔bot 即时自动判定（按性格）。
 */
import { cards } from '../../data/cards';
import { strings } from '../../data/strings';
import { gameConfig } from '../../config/gameConfig';
import { hash01, nextInt } from '../rng';
import type { CardId, GameState, PlayerId } from '../types';
import { BOT_STRATEGIES } from '../bots';
import * as S from './shared';
import type { Outcome } from './shared';

/** 进入 act 时翻 1 张邀请卡（PLAN §5 歧义 7） */
export function drawInviteCard(state: GameState): GameState {
  const turn = state.turn;
  if (!turn || turn.sub.kind !== 'partner' || cards.invites.length === 0) return state;
  const r = nextInt(state.rng, cards.invites.length);
  const invite = cards.invites[r.value];
  let s: GameState = {
    ...state,
    rng: r.rng,
    turn: { ...turn, sub: { ...turn.sub, inviteCardId: invite.id } },
  };
  s = S.logWith(s, strings.log.inviteCard, { item: invite.text });
  return s;
}

/** 各自付自己那份；收币先记账，站末凑够人才发货，不够退款 */
export function respondInvite(state: GameState, accept: boolean): Outcome {
  const turn = state.turn;
  const actor = S.currentActorId(state);
  if (!turn || turn.sub.kind !== 'partner' || !actor) return S.bad('ERR_PHASE');
  const sub = turn.sub;
  const invite = cards.invites.find((i) => i.id === sub.inviteCardId);
  if (!invite || sub.inviteResponded.includes(actor)) return S.bad('ERR_INVALID');
  const p = S.getPlayer(state, actor);

  let s = state;
  if (accept) {
    // 【待确认】jointBuySplit = 'eachPaysOwnShare'：每人只扣自己的 eachCost，绝不替他人付
    if (gameConfig.partner.jointBuySplit !== 'eachPaysOwnShare') return S.bad('ERR_INVALID');
    if (p.coins < invite.eachCost) return S.bad('ERR_NO_COINS');
    s = S.updatePlayer(s, actor, (x) => ({ ...x, coins: x.coins - invite.eachCost }));
  }
  const nextSub = {
    ...sub,
    inviteAccepted: accept ? [...sub.inviteAccepted, actor] : sub.inviteAccepted,
    inviteResponded: [...sub.inviteResponded, actor],
  };
  s = { ...s, turn: { ...s.turn!, sub: nextSub } };
  s = S.logWith(
    s,
    accept ? strings.log.inviteJoin : strings.log.invitePass,
    { name: p.name },
    actor,
    accept ? { kind: S.spendKindOf(invite.giveCardId), coins: invite.eachCost } : undefined,
  );
  return S.ok(s);
}

function removeOne(list: CardId[], id: CardId): CardId[] {
  const i = list.indexOf(id);
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)];
}

/** 一换一：双方 extras 互换，不动币 */
function doSwap(
  state: GameState,
  a: PlayerId,
  b: PlayerId,
  give: CardId,
  want: CardId,
): GameState {
  let s = S.updatePlayer(state, a, (x) => ({
    ...x,
    extras: [...removeOne(x.extras, give), want],
  }));
  s = S.updatePlayer(s, b, (x) => ({ ...x, extras: [...removeOne(x.extras, want), give] }));
  return s;
}

/** bot 是否接受换菜：想要/需要就接；跟跟型中性也更常接（PLAN §5 歧义 6） */
export function botAcceptsSwap(
  state: GameState,
  botId: PlayerId,
  give: CardId,
  want: CardId,
): boolean {
  const bot = S.getPlayer(state, botId);
  if (S.missingIngredients(bot).includes(give)) return true;
  if (S.missingIngredients(bot).includes(want)) return false; // 给出自己还需要的 → 拒
  const strat = BOT_STRATEGIES[bot.personality ?? 'steady'];
  return (
    hash01(state.rng.seed, 'swap-accept', botId, give, want, state.log.length) <
    strat.acceptSwapNeutral
  );
}

export function proposeSwap(
  state: GameState,
  to: PlayerId,
  giveCardId: CardId,
  wantCardId: CardId,
): Outcome {
  const turn = state.turn;
  const actor = S.currentActorId(state);
  if (!turn || turn.sub.kind !== 'partner' || !actor) return S.bad('ERR_PHASE');
  const sub = turn.sub;
  const me = S.getPlayer(state, actor);
  const target = state.players.find((p) => p.id === to);
  if (!target || to === actor) return S.bad('ERR_INVALID');
  if (!me.extras.includes(giveCardId) || !target.extras.includes(wantCardId)) {
    return S.bad('ERR_NO_CARD');
  }

  if (target.isHuman) {
    // 发给真人：进 proposals 等「好呀/不用了」；每站至多 1 个 bot→真人提议
    if (!me.isHuman && sub.humanOffered) return S.bad('ERR_LIMIT');
    const proposal = {
      id: `sp-${state.lap}-${state.stationIndex}-${state.log.length}`,
      kind: 'swap' as const,
      from: actor,
      to,
      giveCardId,
      wantCardId,
    };
    let s: GameState = { ...state, proposals: [...state.proposals, proposal] };
    if (!me.isHuman) {
      s = { ...s, turn: { ...s.turn!, sub: { ...sub, humanOffered: true } } };
    }
    return S.ok(s);
  }

  // 发给 bot：按性格即时判定（不消耗 rng，用稳定哈希保证确定性）
  if (botAcceptsSwap(state, to, giveCardId, wantCardId)) {
    let s = doSwap(state, actor, to, giveCardId, wantCardId);
    s = S.logWith(s, strings.log.swapDone, { name: me.name, item: target.name }, actor);
    return S.ok(s);
  }
  const sig = `${actor}>${to}:${giveCardId}>${wantCardId}`;
  let s: GameState = {
    ...state,
    turn: { ...turn, sub: { ...sub, declinedSwaps: [...sub.declinedSwaps, sig] } },
  };
  s = S.logWith(s, strings.log.swapNo, { name: me.name, item: target.name }, actor);
  return S.ok(s);
}

export function respondSwap(state: GameState, proposalId: string, accept: boolean): Outcome {
  const prop = state.proposals.find((p) => p.id === proposalId && p.kind === 'swap');
  if (!prop || prop.giveCardId === undefined || prop.wantCardId === undefined) {
    return S.bad('ERR_NO_PROPOSAL');
  }
  let s: GameState = { ...state, proposals: state.proposals.filter((p) => p.id !== prop.id) };
  const from = S.getPlayer(s, prop.from);
  const to = S.getPlayer(s, prop.to);
  if (accept) {
    s = doSwap(s, prop.from, prop.to, prop.giveCardId, prop.wantCardId);
    s = S.logWith(s, strings.log.swapDone, { name: from.name, item: to.name }, prop.from);
  } else {
    s = S.logWith(s, strings.log.swapNo, { name: from.name, item: to.name }, prop.from);
  }
  return S.ok(s);
}

/** 站末结算邀请卡：凑够 minPlayers 才各发各的卡；不够则退回各自已付的币 */
export function settleInvite(state: GameState): GameState {
  const turn = state.turn;
  if (!turn || turn.sub.kind !== 'partner' || !turn.sub.inviteCardId) return state;
  const sub = turn.sub;
  const invite = cards.invites.find((i) => i.id === sub.inviteCardId);
  if (!invite) return state;
  let s = state;
  if (sub.inviteAccepted.length >= invite.minPlayers) {
    for (const pid of sub.inviteAccepted) s = S.grantCard(s, pid, invite.giveCardId);
    s = S.logWith(s, strings.log.inviteDone, { item: S.cardName(invite.giveCardId) });
  } else if (sub.inviteAccepted.length > 0) {
    for (const pid of sub.inviteAccepted) {
      s = S.updatePlayer(s, pid, (x) => ({ ...x, coins: x.coins + invite.eachCost }));
      s = S.logWith(
        s,
        strings.log.inviteRefund,
        { name: S.getPlayer(s, pid).name, n: invite.eachCost },
        pid,
        { kind: 'gain', coins: invite.eachCost },
      );
    }
    s = S.logWith(s, strings.log.inviteFail, { item: invite.name });
  }
  return s;
}
