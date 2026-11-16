/**
 * engine.ts —— 纯函数命令引擎。
 * 入口：`initGame(options)` 与 `applyCommand(state, command) => { state, events?, error? }`。
 * 非法命令返回原状态 + 错误码，绝不抛给调用方；无 React、无定时器、无 Date/Math.random。
 */
import { cards } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { strings } from '../data/strings';
import { initRng, nextRng, shuffle } from './rng';
import type {
  BotPersonality,
  CardId,
  CharacterId,
  Command,
  EngineError,
  EngineResult,
  GameState,
  Player,
  PlayerId,
} from './types';
import * as S from './stations/shared';
import type { Outcome } from './stations/shared';
import { drawRecipe } from './stations/drawTask';
import { ensureNeededOnStall, stallBuy, stallHold } from './stations/market';
import {
  drawInviteCard,
  proposeSwap,
  respondInvite,
  respondSwap,
  settleInvite,
} from './stations/partner';
import { payBus } from './stations/bus';
import { chooseEventOption, spinEvent } from './stations/event';
import { parentAnswer, parentBegin, parentContinue, parentSettle, parentSkip } from './stations/parent';
import { resolveHold, storeBuy } from './stations/store';
import { cookAck } from './stations/cook';

/* —— 初始化 —— */

export interface InitOptions {
  seed: number;
  humanCharacterId?: CharacterId;
  botPersonalities?: BotPersonality[]; // p1..p3 的性格（默认按 config 顺序）
}

const freshPlayer = (id: PlayerId, seat: number): Player => ({
  id,
  seatIndex: seat,
  characterId: null,
  name: id,
  isHuman: false,
  personality: null,
  coins: gameConfig.startCoins,
  recipeId: null,
  collected: [],
  extras: [],
  temptations: [],
  holdClip: null,
  busDebt: 0,
  paidEventCount: 0,
  parentUsed: false,
});

export function initGame(options: InitOptions): GameState {
  let rng = initRng(options.seed);
  const recipes = shuffle(rng, cards.recipes.map((r) => r.id));
  rng = recipes.rng;
  const marketPool: CardId[] = [
    ...cards.ingredients.flatMap((i) => Array<string>(4).fill(i.id)),
    ...cards.temptations.flatMap((t) => Array<string>(2).fill(t.id)),
  ];
  const mk = shuffle(rng, marketPool);
  rng = mk.rng;
  const stall = mk.items.slice(0, gameConfig.market.faceUp);
  const deck = mk.items.slice(gameConfig.market.faceUp);

  const humanChar = options.humanCharacterId
    ? cards.characters.find((c) => c.id === options.humanCharacterId)
    : undefined;
  const players: Player[] = [];
  const human: Player = {
    ...freshPlayer('p0', 0),
    isHuman: true,
    characterId: humanChar?.id ?? null,
    name: humanChar?.name ?? 'You',
  };
  players.push(human);
  for (let i = 1; i < gameConfig.playerCount; i++) {
    const per = options.botPersonalities?.[i - 1] ?? gameConfig.bots.personalities[i - 1] ?? 'steady';
    const bc = cards.bots.find((b) => b.personality === per) ?? cards.bots[(i - 1) % cards.bots.length];
    players.push({
      ...freshPlayer(`p${i}`, i),
      characterId: bc.id,
      name: bc.name,
      personality: bc.personality,
    });
  }

  return {
    rng,
    phase: 'intro',
    players,
    humanId: 'p0',
    lap: 1,
    stationIndex: 0,
    turn: null,
    market: { stall, deck },
    recipeDeck: recipes.items,
    proposals: [],
    parentDialog: null,
    plates: null,
    reflections: [],
    pendingDecision: { kind: 'none' },
    helpUsed: 0,
    flags: { fast: false, demo: false },
    log: [],
  };
}

/* —— 回合推进 —— */

function enterStation(s: GameState, lap: number, stationIndex: number): GameState {
  const id = gameConfig.stations[stationIndex].id;
  return {
    ...s,
    phase: 'station',
    lap,
    stationIndex,
    turn: {
      order: S.stationOrder(lap, stationIndex),
      orderIndex: 0,
      turnPhase: 'intro',
      sub: S.initialSub(id),
    },
  };
}

/** 站点卡 ACK 后进入 act：翻邀请卡，然后给第 1 个行动者做回合准备 */
function enterAct(state: GameState): GameState {
  let s: GameState = { ...state, turn: { ...state.turn!, turnPhase: 'act', orderIndex: 0 } };
  if (S.stationId(s) === 'partner') s = drawInviteCard(s);
  return prepareTurn(s);
}

/** 当前行动者的回合准备：重置子状态、跑确定性前置，必要时自动跳过 */
function prepareTurn(state: GameState): GameState {
  let s = state;
  const turn = s.turn!;
  const actor = turn.order[turn.orderIndex];
  switch (S.stationId(s)) {
    case 'market': {
      s = {
        ...s,
        turn: {
          ...turn,
          sub: {
            kind: 'market',
            buysLeft: gameConfig.market.maxBuyPerVisit,
            holdUsed: false,
            boughtIds: [],
          },
        },
      };
      return ensureNeededOnStall(s, actor);
    }
    case 'event':
      return spinEvent(s, actor);
    case 'store':
      return {
        ...s,
        turn: { ...turn, sub: { kind: 'store', holdResolved: false, boughtIds: [] } },
      };
    case 'parent': {
      const p = S.getPlayer(s, actor);
      if (p.parentUsed) {
        return finishPlayer(S.logWith(s, strings.log.parentUsed, { name: p.name }, actor));
      }
      return s;
    }
    default:
      return s;
  }
}

function finishPlayer(state: GameState): GameState {
  const turn = state.turn!;
  const nextIndex = turn.orderIndex + 1;
  if (nextIndex < turn.order.length) {
    return prepareTurn({ ...state, turn: { ...turn, orderIndex: nextIndex } });
  }
  return endStation(state);
}

function endStation(state: GameState): GameState {
  let s = state;
  if (S.stationId(s) === 'partner') s = settleInvite(s);
  const nextIndex = s.stationIndex + 1;
  if (nextIndex < gameConfig.stations.length) {
    return enterStation(s, s.lap, nextIndex);
  }
  if (s.lap < gameConfig.laps) {
    return { ...s, phase: 'basket', turn: null };
  }
  return { ...s, plates: computePlates(s), phase: 'feast', turn: null };
}

function computePlates(state: GameState) {
  return state.players.map((p) => {
    const missing = S.missingIngredients(p);
    const kind =
      missing.length === 0
        ? ('full' as const)
        : missing.length <= gameConfig.plates.simpleMaxMissing
          ? ('simple' as const)
          : ('shadow' as const);
    return { playerId: p.id, kind, missing };
  });
}

/* —— 各 phase 命令处理 —— */

const bad = (error: EngineError): Outcome => ({ error });

function startGame(state: GameState): Outcome {
  const human = S.getPlayer(state, state.humanId);
  if (human.characterId !== null) {
    return { state: enterStation(state, 1, 0) }; // 已预选角色，跳过选人
  }
  return { state: { ...state, phase: 'chooseCharacter' } };
}

function chooseCharacter(state: GameState, characterId: CharacterId): Outcome {
  const c = cards.characters.find((x) => x.id === characterId);
  if (!c) return bad('ERR_INVALID');
  let s = S.updatePlayer(state, state.humanId, (p) => ({
    ...p,
    characterId: c.id,
    name: c.name,
  }));
  s = enterStation(s, 1, 0);
  return { state: s };
}

function chooseReflection(state: GameState, optionId: string, freeText?: string): Outcome {
  const pend = state.pendingDecision;
  if (pend.kind !== 'reflection') return bad('ERR_PHASE');
  const option =
    cards.reflections.humanOptions.find((o) => o.id === optionId) ??
    Object.values(cards.reflections.botLines)
      .flat()
      .find((l) => l.id === optionId);
  if (!option) return bad('ERR_INVALID');
  const player = S.getPlayer(state, pend.playerId);
  const text = freeText?.trim() ? freeText : 'text' in option ? option.text : option.label;
  const reflections = [...state.reflections, { playerId: player.id, optionId, text }];
  const done = reflections.length >= state.players.length;
  let s: GameState = { ...state, reflections, phase: done ? 'finished' : 'reflection' };
  s = S.logWith(s, strings.log.reflection, { name: player.name, item: text }, player.id);
  return { state: s };
}

function demoJump(state: GameState, lap: number, stationIndex: number): Outcome {
  if (
    lap < 1 ||
    lap > gameConfig.laps ||
    stationIndex < 0 ||
    stationIndex >= gameConfig.stations.length
  ) {
    return bad('ERR_INVALID');
  }
  // 只补前置：人人有菜谱、清瞬态、补满摊位；不伪造购买历史（PLAN §5 歧义 14）
  let s: GameState = { ...state, proposals: [], parentDialog: null };
  for (const p of s.players) {
    if (p.recipeId === null && s.recipeDeck.length > 0) {
      const [rid, ...rest] = s.recipeDeck;
      s = { ...s, recipeDeck: rest };
      s = S.updatePlayer(s, p.id, (x) => ({ ...x, recipeId: rid }));
      s = S.logWith(
        s,
        strings.log.drewRecipe,
        { name: S.getPlayer(s, p.id).name, item: S.cardName(rid) },
        p.id,
      );
    }
  }
  const stall = [...s.market.stall];
  const deck = [...s.market.deck];
  for (let i = 0; i < stall.length; i++) if (!stall[i]) stall[i] = deck.shift() ?? null;
  s = { ...s, market: { stall, deck } };
  return { state: enterStation(s, lap, stationIndex) };
}

function routeStation(state: GameState, command: Command): Outcome {
  const turn = state.turn;
  if (!turn) return bad('ERR_PHASE');
  const pend = state.pendingDecision;

  if (turn.turnPhase === 'intro') {
    if (command.type !== 'ACK') return bad('ERR_PHASE');
    return { state: enterAct(state) };
  }
  if (turn.turnPhase !== 'act') return bad('ERR_PHASE');

  // 发给真人的交换提议优先响应
  if (pend.kind === 'swapResponse') {
    return command.type === 'RESPOND_SWAP'
      ? respondSwap(state, command.proposalId, command.accept)
      : bad('ERR_PHASE');
  }

  const sub = turn.sub;
  switch (sub.kind) {
    case 'drawTask':
      if (command.type === 'DRAW_RECIPE') {
        return pend.kind === 'drawRecipe' ? drawRecipe(state) : bad('ERR_INVALID');
      }
      if (command.type === 'ACK') {
        if (pend.kind !== 'ack') return bad('ERR_PHASE');
        const actor = S.currentActorId(state);
        const name = actor ? S.getPlayer(state, actor).name : '';
        return {
          state: finishPlayer(
            S.logWith(state, strings.log.lookRecipe, { name }, actor ?? undefined),
          ),
        };
      }
      return bad('ERR_PHASE');

    case 'market':
      switch (command.type) {
        case 'STALL_BUY':
          return pend.kind === 'marketTurn' ? stallBuy(state, command.cardId) : bad('ERR_PHASE');
        case 'STALL_HOLD':
          return pend.kind === 'marketTurn' ? stallHold(state, command.cardId) : bad('ERR_PHASE');
        case 'RESOLVE_HOLD':
          return pend.kind === 'marketTurn' ? resolveHold(state, command.buy) : bad('ERR_PHASE');
        case 'END_TURN':
          return pend.kind === 'marketTurn'
            ? { state: finishPlayer(state) }
            : bad('ERR_PHASE');
        default:
          return bad('ERR_PHASE');
      }

    case 'partner':
      switch (command.type) {
        case 'RESPOND_INVITE':
          return pend.kind === 'inviteResponse'
            ? respondInvite(state, command.accept)
            : bad('ERR_PHASE');
        case 'PROPOSE_SWAP':
          return pend.kind === 'proposeSwap'
            ? proposeSwap(state, command.to, command.giveCardId, command.wantCardId)
            : bad('ERR_PHASE');
        case 'END_TURN':
          return pend.kind === 'proposeSwap'
            ? { state: finishPlayer(state) }
            : bad('ERR_PHASE');
        default:
          return bad('ERR_PHASE');
      }

    case 'bus':
      return command.type === 'PAY_BUS' && pend.kind === 'payBus' ? payBus(state) : bad('ERR_PHASE');

    case 'event':
      return command.type === 'CHOOSE_EVENT_OPTION' && pend.kind === 'eventOption'
        ? chooseEventOption(state, command.option)
        : bad('ERR_PHASE');

    case 'parent':
      switch (command.type) {
        case 'PARENT_BEGIN':
          return pend.kind === 'parentUse' ? parentBegin(state) : bad('ERR_PHASE');
        case 'PARENT_SKIP':
          return pend.kind === 'parentUse' ? parentSkip(state) : bad('ERR_PHASE');
        case 'PARENT_ANSWER':
          return pend.kind === 'parentAnswer' || pend.kind === 'parentSettle'
            ? parentAnswer(state, command.answer)
            : bad('ERR_PHASE');
        case 'PARENT_SETTLE':
          return pend.kind === 'parentSettle' ? parentSettle(state) : bad('ERR_PHASE');
        case 'ACK':
          return pend.kind === 'parentSettle' ? parentContinue(state) : bad('ERR_PHASE');
        default:
          return bad('ERR_PHASE');
      }

    case 'store':
      switch (command.type) {
        case 'STORE_BUY':
          return pend.kind === 'storeTurn' ? storeBuy(state, command.ingredientId) : bad('ERR_PHASE');
        case 'RESOLVE_HOLD':
          return pend.kind === 'storeTurn' ? resolveHold(state, command.buy) : bad('ERR_PHASE');
        case 'END_TURN':
          return pend.kind === 'storeTurn' ? { state: finishPlayer(state) } : bad('ERR_PHASE');
        default:
          return bad('ERR_PHASE');
      }

    case 'cook':
      return command.type === 'ACK' && pend.kind === 'ack'
        ? { state: finishPlayer(cookAck(state)) }
        : bad('ERR_PHASE');
  }
}

function route(state: GameState, command: Command): Outcome {
  // 全局面命令：任何阶段都合法
  switch (command.type) {
    case 'RESTART': {
      const { value } = nextRng(state.rng);
      const human = S.getPlayer(state, state.humanId);
      return {
        state: initGame({
          seed: Math.floor(value * 0xffffffff),
          humanCharacterId: human.characterId ?? undefined,
          botPersonalities: state.players
            .filter((p) => !p.isHuman)
            .map((p) => p.personality ?? 'steady'),
        }),
      };
    }
    case 'TOGGLE_HELP':
      return { state: { ...state, helpUsed: state.helpUsed + 1 } };
    case 'SET_FLAG':
      return { state: { ...state, flags: { ...state.flags, [command.flag]: command.value } } };
    case 'DEMO_SET_PERSONALITY': {
      const p = state.players.find((x) => x.id === command.playerId);
      if (!p || p.isHuman) return bad('ERR_INVALID');
      return {
        state: S.updatePlayer(state, command.playerId, (x) => ({
          ...x,
          personality: command.personality,
        })),
      };
    }
    case 'DEMO_JUMP':
      return demoJump(state, command.lap, command.stationIndex);
    default:
      break;
  }

  switch (state.phase) {
    case 'intro':
      return command.type === 'START_GAME' ? startGame(state) : bad('ERR_PHASE');
    case 'chooseCharacter':
      return command.type === 'CHOOSE_CHARACTER'
        ? chooseCharacter(state, command.characterId)
        : bad('ERR_PHASE');
    case 'basket': {
      if (command.type !== 'ACK') return bad('ERR_PHASE');
      const lap = state.lap + 1;
      return { state: enterStation({ ...state, phase: 'station' }, lap, 0) };
    }
    case 'feast':
      return command.type === 'ACK' ? { state: { ...state, phase: 'reflection' } } : bad('ERR_PHASE');
    case 'reflection':
      return command.type === 'CHOOSE_REFLECTION'
        ? chooseReflection(state, command.optionId, command.freeText)
        : bad('ERR_PHASE');
    case 'finished':
      return bad('ERR_PHASE'); // 再玩一局走 RESTART
    case 'station':
      return routeStation(state, command);
  }
}

/** 引擎唯一入口 */
export function applyCommand(state: GameState, command: Command): EngineResult {
  const logBefore = state.log.length;
  const r = route(state, command);
  if ('error' in r) return { state, error: r.error };
  let next = r.state;
  if (r.done) next = finishPlayer(next);
  next = { ...next, pendingDecision: S.computePending(next) };
  return { state: next, events: next.log.slice(logBefore) };
}
