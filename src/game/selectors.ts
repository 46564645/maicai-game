/**
 * selectors.ts —— 派生数据（纯函数，UI/bot/测试共用）。
 * availableCommands 返回当前所有「合法」命令；helpHints 生成求助牌内容。
 */
import { cards, getIngredient, getRecipe } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { strings } from '../data/strings';
import type {
  CardId,
  Command,
  GameState,
  LogEntry,
  Player,
  PlayerId,
  PlateResult,
  SpendKind,
} from './types';
import * as S from './stations/shared';

export const missingIngredients = S.missingIngredients;
export const marketPriceOf = S.marketPriceOf;

export function activePlayer(state: GameState): Player | null {
  const id = S.currentActorId(state);
  return id ? S.getPlayer(state, id) : null;
}

/** 当前等待输入的玩家（phase 级决定默认归真人） */
export function pendingActorId(state: GameState): PlayerId {
  const pd = state.pendingDecision;
  return pd.kind === 'none' ? state.humanId : pd.playerId;
}

export function canAfford(p: Player, cost: number): boolean {
  return p.coins >= cost;
}

/** 菜谱缺口的市场价合计（衡量「还差多少钱」） */
export function missingCost(p: Player): number {
  return missingIngredients(p).reduce(
    (sum, id) => sum + (getIngredient(id)?.marketPrice ?? 0),
    0,
  );
}

export function plateKindOf(missingCount: number): PlateResult['kind'] {
  if (missingCount === 0) return 'full';
  return missingCount <= gameConfig.plates.simpleMaxMissing ? 'simple' : 'shadow';
}

/* —— availableCommands：当前玩家的全部合法命令 —— */

function uniqStall(state: GameState): CardId[] {
  return [...new Set(state.market.stall.filter((x): x is CardId => x !== null))];
}

function marketCommands(state: GameState, me: Player): Command[] {
  const sub = state.turn!.sub;
  if (sub.kind !== 'market') return [];
  const cmds: Command[] = [];
  const stall = uniqStall(state).filter((id) => !sub.boughtIds.includes(id));
  if (sub.buysLeft > 0) {
    for (const id of stall) {
      const price = marketPriceOf(id);
      if (price !== null && me.coins >= price) cmds.push({ type: 'STALL_BUY', cardId: id });
    }
  }
  if (me.holdClip !== null) {
    const price = marketPriceOf(me.holdClip);
    if (price !== null && me.coins >= price) cmds.push({ type: 'RESOLVE_HOLD', buy: true });
    cmds.push({ type: 'RESOLVE_HOLD', buy: false });
  }
  if (!sub.holdUsed && me.holdClip === null) {
    for (const id of stall) cmds.push({ type: 'STALL_HOLD', cardId: id });
  }
  cmds.push({ type: 'END_TURN' });
  return cmds;
}

function partnerCommands(state: GameState, me: Player): Command[] {
  const sub = state.turn!.sub;
  if (sub.kind !== 'partner') return [];
  if (!sub.inviteResponded.includes(me.id)) {
    const invite = cards.invites.find((i) => i.id === sub.inviteCardId);
    const cmds: Command[] = [];
    const proposalId = S.inviteProposalId(state, me.id);
    if (invite && me.coins >= invite.eachCost) {
      cmds.push({ type: 'RESPOND_INVITE', proposalId, accept: true });
    }
    cmds.push({ type: 'RESPOND_INVITE', proposalId, accept: false });
    return cmds;
  }
  const cmds: Command[] = [{ type: 'END_TURN' }];
  for (const target of state.players) {
    if (target.id === me.id) continue;
    for (const want of target.extras) {
      for (const give of me.extras) {
        cmds.push({ type: 'PROPOSE_SWAP', to: target.id, giveCardId: give, wantCardId: want });
      }
    }
  }
  return cmds;
}

function storeCommands(state: GameState, me: Player): Command[] {
  const sub = state.turn!.sub;
  if (sub.kind !== 'store') return [];
  const cmds: Command[] = [];
  const missing = missingIngredients(me);
  const buyable = (id: CardId) =>
    !sub.boughtIds.includes(id) &&
    me.coins >= (getIngredient(id)?.marketPrice ?? 0) + gameConfig.store.markup;
  for (const ing of cards.ingredients) {
    if (missing.includes(ing.id) && buyable(ing.id)) {
      cmds.push({ type: 'STORE_BUY', ingredientId: ing.id });
    }
  }
  for (const ing of cards.ingredients) {
    if (!missing.includes(ing.id) && buyable(ing.id)) {
      cmds.push({ type: 'STORE_BUY', ingredientId: ing.id });
    }
  }
  if (me.holdClip !== null) {
    const price = marketPriceOf(me.holdClip);
    if (price !== null && me.coins >= price) cmds.push({ type: 'RESOLVE_HOLD', buy: true });
    cmds.push({ type: 'RESOLVE_HOLD', buy: false });
  }
  cmds.push({ type: 'END_TURN' });
  return cmds;
}

export function availableCommands(state: GameState): Command[] {
  const pd = state.pendingDecision;
  switch (state.phase) {
    case 'intro':
      return [{ type: 'START_GAME' }];
    case 'chooseCharacter':
      return cards.characters.map((c) => ({ type: 'CHOOSE_CHARACTER', characterId: c.id }));
    case 'basket':
    case 'feast':
      return [{ type: 'ACK' }];
    case 'finished':
      return [{ type: 'RESTART' }];
    case 'reflection': {
      if (pd.kind !== 'reflection') return [];
      const me = S.getPlayer(state, pd.playerId);
      if (me.isHuman) {
        return cards.reflections.humanOptions.map((o) => ({
          type: 'CHOOSE_REFLECTION',
          optionId: o.id,
        }));
      }
      return (cards.reflections.botLines[me.personality ?? 'steady'] ?? []).map((l) => ({
        type: 'CHOOSE_REFLECTION',
        optionId: l.id,
      }));
    }
    case 'station':
      break;
  }

  if (state.turn?.turnPhase === 'intro' || pd.kind === 'ack') return [{ type: 'ACK' }];
  if (pd.kind === 'drawRecipe') return [{ type: 'DRAW_RECIPE' }];
  if (pd.kind === 'payBus') return [{ type: 'PAY_BUS' }];
  if (pd.kind === 'swapResponse') {
    return [
      { type: 'RESPOND_SWAP', proposalId: pd.proposalId, accept: true },
      { type: 'RESPOND_SWAP', proposalId: pd.proposalId, accept: false },
    ];
  }
  const me = S.getPlayer(state, pendingActorId(state));
  switch (pd.kind) {
    case 'marketTurn':
      return marketCommands(state, me);
    case 'inviteResponse':
    case 'proposeSwap':
      return partnerCommands(state, me);
    case 'eventOption': {
      const sub = state.turn!.sub;
      const card = sub.kind === 'event' ? cards.events.find((e) => e.id === sub.eventCardId) : null;
      const cmds: Command[] = [{ type: 'CHOOSE_EVENT_OPTION', option: 'free' }];
      if (
        card &&
        me.paidEventCount < gameConfig.events.maxPaidPerPlayer &&
        me.coins >= (card.spendOption.coins ?? 0)
      ) {
        cmds.push({ type: 'CHOOSE_EVENT_OPTION', option: 'spend' });
      }
      return cmds;
    }
    case 'parentUse':
      return [{ type: 'PARENT_BEGIN' }, { type: 'PARENT_SKIP' }];
    case 'parentAnswer': {
      const q = cards.parentStation.questions[pd.step];
      return (q?.options ?? []).map((o) => ({
        type: 'PARENT_ANSWER',
        answer: { mode: 'card', optionId: o.id },
      }));
    }
    case 'parentSettle':
      return [{ type: 'PARENT_SETTLE' }, { type: 'ACK' }];
    case 'storeTurn':
      return storeCommands(state, me);
    default:
      return [];
  }
}

/* —— 钱包摘要（钱包抽屉与求助牌共用，PLAN 4.1.8.2；纯派生）—— */

export interface WalletSummary {
  coins: number;
  busDebt: number;
  missingCost: number; // 菜谱缺口的市场价合计
  freeEstimate: number; // 估计还能自由花的币（币数 − 缺口 − 欠车费）
  holdClip: CardId | null;
  recipeName: string | null;
  recentLogs: LogEntry[]; // 最近 n 条：自己的动作 + 全局事件
}

export function walletSummary(state: GameState, playerId: PlayerId, recentCount = 5): WalletSummary {
  const p = S.getPlayer(state, playerId);
  const missing = missingCost(p);
  const recentLogs = state.log
    .filter((e) => e.playerId === undefined || e.playerId === playerId)
    .slice(-recentCount);
  return {
    coins: p.coins,
    busDebt: p.busDebt,
    missingCost: missing,
    freeEstimate: p.coins - missing - p.busDebt,
    holdClip: p.holdClip,
    recipeName: p.recipeId ? (getRecipe(p.recipeId)?.name ?? null) : null,
    recentLogs,
  };
}

/* —— G6「看看钱花到哪了」流水（纯派生，只读 state.log 的 spend 记账）—— */

export interface MoneyLedgerLine {
  id: number;
  text: string;
  coins: number;
  lap?: number; // 这笔发生在第几圈（同名的两笔才分得清是两次）
}

export interface MoneyLedgerGroup {
  kind: SpendKind;
  label: string;
  total: number;
  lines: MoneyLedgerLine[];
}

export interface MoneyLedger {
  startCoins: number;
  coinsLeft: number;
  busDebt: number; // 还欠着的车费（尚未花出去）
  groups: MoneyLedgerGroup[];
}

const LEDGER_ORDER: SpendKind[] = ['gain', 'ingredient', 'temptation', 'bus', 'event'];

/** 真人自己的花钱流水：开局 → 分组小计 → 剩余；不与他人比较 */
export function moneyLedger(state: GameState, playerId: PlayerId): MoneyLedger {
  const p = S.getPlayer(state, playerId);
  const entries = state.log.filter((e) => e.playerId === playerId && e.spend !== undefined);
  const groups = LEDGER_ORDER.map((kind) => {
    const lines = entries
      .filter((e) => e.spend!.kind === kind)
      .map((e) => ({ id: e.id, text: e.text, coins: e.spend!.coins, lap: e.lap }));
    return {
      kind,
      label: strings.ledger.groups[kind],
      total: lines.reduce((sum, l) => sum + l.coins, 0),
      lines,
    };
  }).filter((g) => g.lines.length > 0);
  return {
    startCoins: gameConfig.startCoins,
    coinsLeft: p.coins,
    busDebt: p.busDebt,
    groups,
  };
}

/* —— 求助牌 —— */

export interface HelpHints {
  coins: number;
  busDebt: number;
  missing: { id: CardId; name: string; icon: string }[];
  recipeName: string | null;
  stationName: string | null;
  stationGoal: string | null;
  canDo: string[];
  tip: string;
}

const CMD_LABELS: Record<Command['type'], string> = {
  START_GAME: 'Start the game',
  CHOOSE_CHARACTER: 'Pick a character',
  ACK: 'Next',
  DRAW_RECIPE: 'Draw a recipe card',
  STALL_BUY: 'Buy a card',
  STALL_HOLD: 'Put in "maybe later"',
  END_TURN: 'Done with this stop',
  PROPOSE_SWAP: 'Trade food with a friend',
  RESPOND_SWAP: 'Answer a trade',
  RESPOND_INVITE: 'Answer a buy-together',
  PAY_BUS: 'Pay the bus fare',
  CHOOSE_EVENT_OPTION: 'Pick what to do',
  PARENT_BEGIN: 'Talk to your parent',
  PARENT_SKIP: 'Not this time',
  PARENT_ANSWER: 'Answer a question',
  PARENT_SETTLE: "That's all",
  STORE_BUY: 'Buy one ingredient',
  RESOLVE_HOLD: 'Handle "maybe later"',
  CHOOSE_REFLECTION: 'Tell us one choice',
  RESTART: 'Play again',
  TOGGLE_HELP: 'Hint',
  DEMO_JUMP: 'Jump to a stop',
  DEMO_SET_PERSONALITY: 'Change bot style',
  SET_FLAG: 'Toggle',
};

/** 求助牌内容：只读派生数据，不改变状态（计次走 TOGGLE_HELP） */
export function helpHints(state: GameState, playerId: PlayerId): HelpHints {
  const p = S.getPlayer(state, playerId);
  const recipe = p.recipeId ? getRecipe(p.recipeId) : null;
  const missing = missingIngredients(p).map((id) => {
    const ing = getIngredient(id);
    return { id, name: ing?.name ?? id, icon: ing?.icon ?? '❔' };
  });
  const station = state.phase === 'station' ? gameConfig.stations[state.stationIndex] : null;
  const canDo = [...new Set(availableCommands(state).map((c) => CMD_LABELS[c.type]))];
  const tip =
    (station && strings.help.stationTips[station.id]) || strings.help.gentleAdvice;
  return {
    coins: p.coins,
    busDebt: p.busDebt,
    missing,
    recipeName: recipe?.name ?? null,
    stationName: station?.name ?? null,
    stationGoal: station?.goal ?? null,
    canDo,
    tip,
  };
}
