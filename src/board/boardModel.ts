/**
 * boardModel.ts —— GameState → BoardViewProps 纯函数（2D/3D 共用）。
 * 玩家颜色按 PLAN 4.1.5：真人=暖橙，bot 按性格取色【待确认】。
 */
import { cards, getRecipe } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { playerDisplayName, stationGoal, stationName } from '../i18n/cardText';
import * as S from '../game/stations/shared';
import type { BotPersonality, GameState, Player } from '../game/types';
import type { BoardViewProps } from './BoardView';

const PERSONALITY_COLOR: Record<BotPersonality, string> = {
  steady: 'var(--player-steady)',
  impulsive: 'var(--player-impulsive)',
  follower: 'var(--player-follower)',
};

function playerIcon(p: Player): string {
  const card =
    cards.characters.find((c) => c.id === p.characterId) ??
    cards.bots.find((b) => b.id === p.characterId);
  return card?.icon ?? '●';
}

export function toBoardView(state: GameState): BoardViewProps {
  // 最近一次得/失币（3D 硬币飞行动画的触发信号；流水本身不重复记）
  const spendLog = [...state.log].reverse().find((e) => e.spend !== undefined);
  return {
    stations: gameConfig.stations.map((s, index) => ({
      index,
      id: s.id,
      name: stationName(s.id),
      goal: stationGoal(s.id),
      isCurrent: state.phase === 'station' && state.stationIndex === index,
    })),
    pawns: state.players.map((p) => ({
      playerId: p.id,
      name: playerDisplayName(p),
      icon: playerIcon(p),
      colorVar: p.isHuman ? 'var(--player-you)' : PERSONALITY_COLOR[p.personality ?? 'steady'],
      recipe: p.recipeId
        ? { done: p.collected.length, total: getRecipe(p.recipeId)?.ingredientIds.length ?? 0 }
        : undefined,
    })),
    lap: state.lap,
    laps: gameConfig.laps,
    stationIndex: state.stationIndex,
    order: state.turn?.order ?? [],
    activePlayerId: S.currentActorId(state),
    weather: {
      id: state.turn?.sub.kind === 'event' ? state.turn.sub.weatherId : null,
      nonce: state.turn?.orderIndex ?? 0,
    },
    // R1-E3：天气时刻轮到 bot 时走简版（转盘直落、不推近）——行动者
    // 非真人即 quick；真人回合保持完整样板节奏。
    weatherQuick: (() => {
      const actorId = S.currentActorId(state);
      const actor = state.players.find((p) => p.id === actorId);
      return !!actor && !actor.isHuman;
    })(),
    fx: spendLog
      ? {
          nonce: spendLog.id,
          playerId: spendLog.playerId ?? S.currentActorId(state),
          kind: spendLog.spend!.kind === 'gain' ? 'gain' : 'spend',
        }
      : undefined,
  };
}
