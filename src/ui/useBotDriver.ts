/**
 * useBotDriver.ts —— bot 定时推进。
 * 当 pendingDecision 指向一个电脑玩家时，setTimeout(delay) 后提交
 * chooseBotCommand(state, pid)；一次命令后若仍轮到同一 bot，下一轮继续
 * （实现「动作间隔 ≈800ms」；?fast=1 时为 0）。
 * 站点卡（turnPhase='intro'）的 ACK 也归 bot 自己点：首位行动者是 bot 时
 * 自动进入这一站，真人只需点自己先行的站（马教授试玩反馈 H）。
 */
import { useEffect } from 'react';
import { gameConfig } from '../config/gameConfig';
import { chooseBotCommand } from '../game/bots';
import type { Command, GameState } from '../game/types';

export function useBotDriver(state: GameState, send: (cmd: Command) => unknown) {
  const pd = state.pendingDecision;
  const pid = 'playerId' in pd ? pd.playerId : null;
  const isBotTurn =
    pid !== null && state.players.some((p) => p.id === pid && !p.isHuman);

  useEffect(() => {
    if (!isBotTurn || pid === null) return;
    const delay = state.flags.fast ? gameConfig.timing.fastDelayMs : gameConfig.timing.botDelayMs;
    const t = window.setTimeout(() => {
      send(chooseBotCommand(state, pid));
    }, delay);
    return () => window.clearTimeout(t);
  }, [state, isBotTurn, pid, send]);
}
