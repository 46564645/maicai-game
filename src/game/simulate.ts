/**
 * simulate.ts —— 无定时器的同步整局驱动（供单测/快速验证）。
 * 真人的每一步由可注入脚本给出（默认「第一个合法命令」），bot 走
 * chooseBotCommand；带最大步数保护，返回终局状态与命令日志。
 */
import { applyCommand, initGame } from './engine';
import { chooseBotCommand } from './bots';
import { availableCommands, pendingActorId } from './selectors';
import * as S from './stations/shared';
import { hash01 } from './rng';
import type { BotPersonality, CharacterId, Command, GameState } from './types';

export type HumanScript = (state: GameState) => Command;

export interface SimulateOptions {
  seed: number;
  humanCharacterId?: CharacterId;
  botPersonalities?: BotPersonality[];
  humanScript?: HumanScript;
  maxSteps?: number;
  onStep?: (prev: GameState, command: Command, next: GameState | undefined, error?: string) => void;
}

export interface SimulateResult {
  state: GameState;
  steps: number;
  commands: Command[];
  error?: string;
}

const DEFAULT_MAX_STEPS = 5000;

export function simulate(options: SimulateOptions): SimulateResult {
  let state = initGame({
    seed: options.seed,
    humanCharacterId: options.humanCharacterId,
    botPersonalities: options.botPersonalities,
  });
  const script = options.humanScript ?? humanScripts.first;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const commands: Command[] = [];

  for (let i = 0; i < maxSteps; i++) {
    if (state.phase === 'finished') return { state, steps: i, commands };
    const actor = pendingActorId(state);
    const actorIsBot = state.players.find((p) => p.id === actor)?.isHuman === false;
    const cmd = actorIsBot ? chooseBotCommand(state, actor) : script(state);
    const r = applyCommand(state, cmd);
    commands.push(cmd);
    options.onStep?.(state, cmd, r.error ? undefined : r.state, r.error);
    if (r.error) {
      return { state, steps: i + 1, commands, error: `${r.error} on ${JSON.stringify(cmd)}` };
    }
    state = r.state;
  }
  return { state, steps: maxSteps, commands, error: 'MAX_STEPS' };
}

/* —— 内置真人脚本 —— */

function pick(cmds: Command[], prefs: ((c: Command) => boolean)[]): Command {
  for (const f of prefs) {
    const c = cmds.find(f);
    if (c) return c;
  }
  return cmds[0];
}

export const humanScripts = {
  /** 总是选第一个合法命令 */
  first: (state: GameState): Command => availableCommands(state)[0] ?? { type: 'ACK' },

  /** 随机合法命令（用稳定哈希，同种子可复现） */
  random: (state: GameState): Command => {
    const cmds = availableCommands(state);
    if (cmds.length === 0) return { type: 'ACK' };
    const i = Math.floor(
      hash01(state.rng.seed, 'human-random', state.rng.cursor, state.log.length) * cmds.length,
    );
    return cmds[i % cmds.length];
  },

  /** 尽量不花钱：事件选不花钱、拒绝一起买/换菜、不去家长站、只买缺的材料 */
  frugal: (state: GameState): Command => {
    const cmds = availableCommands(state);
    const missing = S.missingIngredients(S.getPlayer(state, pendingActorId(state)));
    return pick(cmds, [
      (c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'free',
      (c) => c.type === 'RESPOND_INVITE' && !c.accept,
      (c) => c.type === 'RESPOND_SWAP' && !c.accept,
      (c) => c.type === 'PARENT_SKIP',
      (c) => c.type === 'STALL_BUY' && missing.includes(c.cardId),
      (c) => c.type === 'STORE_BUY' && missing.includes(c.ingredientId),
      (c) => c.type === 'RESOLVE_HOLD' && c.buy && missing.includes(getHoldClip(state)),
      (c) => c.type === 'END_TURN',
    ]);
  },

  /** 尽量买诱惑：事件选花钱、一起买照单全收、优先买诱惑品、常用先等等 */
  tempted: (state: GameState): Command => {
    const cmds = availableCommands(state);
    return pick(cmds, [
      (c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'spend',
      (c) => c.type === 'RESPOND_INVITE' && c.accept,
      (c) => c.type === 'RESPOND_SWAP' && c.accept,
      (c) => c.type === 'STALL_BUY' && S.isTemptation(c.cardId),
      (c) => c.type === 'PARENT_BEGIN',
      (c) => c.type === 'STALL_BUY',
      (c) => c.type === 'RESOLVE_HOLD' && c.buy,
      (c) => c.type === 'STALL_HOLD',
      (c) => c.type === 'STORE_BUY',
    ]);
  },
} as const;

function getHoldClip(state: GameState): string {
  return S.getPlayer(state, pendingActorId(state)).holdClip ?? '';
}
