/**
 * useBotDriver.ts —— bot 定时推进。
 * 当 pendingDecision 指向一个电脑玩家时，setTimeout(delay) 后提交
 * chooseBotCommand(state, pid)；一次命令后若仍轮到同一 bot，下一轮继续。
 * 站点卡（turnPhase='intro'）的 ACK 也归 bot 自己点：首位行动者是 bot 时
 * 自动进入这一站，真人只需点自己先行的站（马教授试玩反馈 H）。
 *
 * R1-E3（bot 回合总预算）：延迟不再固定 800ms/条——按 botTiming 的
 * 阶梯（首条 base、后续 250/120ms 递减），典型回合（3–5 条命令）
 * 总时长 1.3–1.7s ≤ 2s 预算。回合以（圈·站·行动序位·玩家）为键计数，
 * 换站/换人自动清零。快进：孩子点当前 bot 的角落小卡时 Game 发
 * BOT_FAST_FORWARD_EVENT——本驱动立即提交手头这条命令，且本回合
 * 剩余命令一律 0 延迟。?fast=1 时仍是全程 0（fastDelayMs）。
 */
import { useEffect, useRef } from 'react';
import { gameConfig } from '../config/gameConfig';
import { chooseBotCommand } from '../game/bots';
import type { Command, GameState, PlayerId } from '../game/types';
import {
  BOT_FAST_FORWARD_EVENT,
  botCommandDelayMs,
} from './botTiming';

/** 一个 bot 回合的键：同站同序位同玩家 = 同一回合 */
function botTurnKey(state: GameState, pid: PlayerId): string {
  return `${state.lap}:${state.stationIndex}:${state.turn?.orderIndex ?? -1}:${pid}`;
}

export function useBotDriver(state: GameState, send: (cmd: Command) => unknown) {
  const pd = state.pendingDecision;
  const pid = 'playerId' in pd ? pd.playerId : null;
  const isBotTurn =
    pid !== null && state.players.some((p) => p.id === pid && !p.isHuman);

  /* 快进要能立刻提交「当前这条」：手头定时器、待发命令的回合键、
     以及最新 state/send 都存 ref（事件回调里读到的必须是最新的） */
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ pid: PlayerId; key: string } | null>(null);
  const ffKeyRef = useRef<string | null>(null);
  const stepRef = useRef<{ key: string; step: number }>({ key: '', step: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!isBotTurn || pid === null) {
      pendingRef.current = null;
      return undefined;
    }
    const key = botTurnKey(state, pid);
    if (stepRef.current.key !== key) stepRef.current = { key, step: 0 };
    const fast = state.flags.fast || ffKeyRef.current === key;
    const delay = fast
      ? gameConfig.timing.fastDelayMs
      : botCommandDelayMs(stepRef.current.step, gameConfig.timing.botDelayMs);
    pendingRef.current = { pid, key };
    const t = window.setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      stepRef.current = { key, step: stepRef.current.step + 1 };
      send(chooseBotCommand(state, pid));
    }, delay);
    timerRef.current = t;
    return () => {
      window.clearTimeout(t);
      if (timerRef.current === t) timerRef.current = null;
    };
  }, [state, isBotTurn, pid, send]);

  /* 快进监听：命中当前待发命令 → 清定时器、立即提交、本回合余下清零 */
  useEffect(() => {
    const onFastForward = (e: Event) => {
      const wanted = (e as CustomEvent<{ playerId?: string }>).detail?.playerId;
      const pend = pendingRef.current;
      if (!pend) return;
      if (wanted && wanted !== pend.pid) return;
      ffKeyRef.current = pend.key;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = null;
      stepRef.current = { key: pend.key, step: stepRef.current.step + 1 };
      sendRef.current(chooseBotCommand(stateRef.current, pend.pid));
    };
    window.addEventListener(BOT_FAST_FORWARD_EVENT, onFastForward);
    return () => window.removeEventListener(BOT_FAST_FORWARD_EVENT, onFastForward);
  }, []);
}
