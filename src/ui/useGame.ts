/**
 * useGame.ts —— 引擎的 React 包装。
 * useReducer 语义：state 只有一个不可变 GameState；send(cmd) 走 applyCommand，
 * 非法命令不改 state、把 error 存到 lastError 供界面提示。
 * URL 参数：?seed=123 固定种子；?fast=1 bot 无延迟；?demo=1 演示条
 * （仅 VITE_DEMO_BAR=1 的构建生效——常规构建里 flags.demo 恒 false，
 * 演示条不渲染、层栈也不会开空层）。
 */
import { useCallback, useRef, useState } from 'react';
import { applyCommand, initGame } from '../game/engine';
import type { Command, EngineError, EngineResult, GameState, LogEntry } from '../game/types';

interface UrlFlags {
  seed: number;
  fast: boolean;
  demo: boolean;
}

function readUrlFlags(): UrlFlags {
  const q = new URLSearchParams(window.location.search);
  const seedRaw = q.get('seed');
  const seed = seedRaw === null ? 1 : Number(seedRaw);
  return {
    seed: Number.isFinite(seed) ? seed : 1,
    fast: q.get('fast') === '1',
    demo: import.meta.env.VITE_DEMO_BAR === '1' && q.get('demo') === '1',
  };
}

export function useGame() {
  const flagsRef = useRef<UrlFlags>(readUrlFlags());
  const [state, setState] = useState<GameState>(() => {
    let s = initGame({ seed: flagsRef.current.seed });
    if (flagsRef.current.fast) {
      s = applyCommand(s, { type: 'SET_FLAG', flag: 'fast', value: true }).state;
    }
    if (flagsRef.current.demo) {
      s = applyCommand(s, { type: 'SET_FLAG', flag: 'demo', value: true }).state;
    }
    return s;
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const [lastError, setLastError] = useState<EngineError | null>(null);
  const [lastEvents, setLastEvents] = useState<LogEntry[]>([]);

  const send = useCallback((cmd: Command): EngineResult => {
    const r = applyCommand(stateRef.current, cmd);
    if (r.error) {
      setLastError(r.error);
      return r;
    }
    setLastError(null);
    setLastEvents(r.events ?? []);
    stateRef.current = r.state;
    setState(r.state);
    return r;
  }, []);

  return { state, send, lastError, lastEvents };
}

export type SendCommand = (cmd: Command) => EngineResult;
