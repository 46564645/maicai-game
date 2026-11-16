import { applyCommand, initGame } from '../../src/game/engine';
import { computePending, stationOrder } from '../../src/game/stations/shared';
import type { Command, GameState, PlayerId } from '../../src/game/types';

/** 应用命令，出错就抛（测试里表示「不该失败」） */
export function run(state: GameState, c: Command): GameState {
  const r = applyCommand(state, c);
  if (r.error) throw new Error(`unexpected ${r.error} on ${JSON.stringify(c)}`);
  return r.state;
}

export function tryRun(state: GameState, c: Command) {
  return applyCommand(state, c);
}

/** 开局：真人预选小禾，START_GAME 直达第 1 圈第 1 站站点卡 */
export function boot(seed = 1): GameState {
  const s = initGame({ seed, humanCharacterId: 'chr-xiaohe' });
  return run(s, { type: 'START_GAME' });
}

/** DEMO_JUMP 到某站，可选把指定玩家排成本站第一个行动者，再 ACK 进入行动 */
export function jumpTo(
  state: GameState,
  lap: number,
  stationIndex: number,
  firstActor?: PlayerId,
): GameState {
  let s = run(state, { type: 'DEMO_JUMP', lap, stationIndex });
  if (firstActor && s.turn) {
    const order = [firstActor, ...s.turn.order.filter((o) => o !== firstActor)];
    s = { ...s, turn: { ...s.turn, order } };
  }
  s = run(s, { type: 'ACK' });
  return s;
}

/** 直接改某个玩家的字段（构造测试场景用，不经过命令） */
export function patchPlayer(
  state: GameState,
  pid: PlayerId,
  patch: Partial<import('../../src/game/types').Player>,
): GameState {
  const players = state.players.map((p) => (p.id === pid ? { ...p, ...patch } : p));
  const s = { ...state, players };
  return { ...s, pendingDecision: computePending(s) };
}

export function actorOf(state: GameState): PlayerId {
  const id = state.turn!.order[state.turn!.orderIndex];
  return id;
}

export { stationOrder };
