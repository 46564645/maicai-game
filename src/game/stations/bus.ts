/**
 * bus.ts —— 04 公交站。
 * 每人投 busFeeByLap[lap-1] 币（默认只在第 1 圈收）；钱不够就把差额夹进
 * 「待付夹」，之后一有钱先自动补车费（gainCoins 统一处理）。
 */
import { gameConfig } from '../../config/gameConfig';
import { strings } from '../../data/strings';
import type { GameState } from '../types';
import * as S from './shared';
import type { Outcome } from './shared';

export function payBus(state: GameState): Outcome {
  const actor = S.currentActorId(state);
  if (!actor) return S.bad('ERR_PHASE');
  const p = S.getPlayer(state, actor);
  const fee = gameConfig.busFeeByLap[state.lap - 1] ?? 0;
  let s = state;
  if (fee <= 0) {
    s = S.logWith(s, strings.log.busFree, { name: p.name }, actor);
  } else {
    const pay = Math.min(p.coins, fee);
    const debt = fee - pay;
    s = S.updatePlayer(s, actor, (x) => ({
      ...x,
      coins: x.coins - pay,
      busDebt: x.busDebt + debt,
    }));
    s = S.logWith(
      s,
      debt > 0 ? strings.log.busDebt : strings.log.busPaid,
      { name: p.name, n: debt > 0 ? debt : fee },
      actor,
      pay > 0 ? { kind: 'bus', coins: pay } : undefined,
    );
  }
  return S.ok(s, true);
}
