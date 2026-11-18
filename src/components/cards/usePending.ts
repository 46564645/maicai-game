/**
 * usePending.ts —— PendingCommit 的 React 包装：挂起标签落到 state 里，
 * 面板用它渲染「等等！收回」撤销片。派发逻辑（send）完全由调用方传入。
 */
import { useEffect, useRef, useState } from 'react';
import { PendingCommit, PENDING_MS } from './pendingCommit';

export interface UsePending {
  /** 非 null = 有一笔派发在后悔窗口里，值是它的展示名 */
  pendingLabel: string | null;
  /** 挂起一次派发；窗口被占用时返回 false（UI 可据此忽略第二下连点） */
  arm: (label: string, run: () => void) => boolean;
  cancel: () => void;
}

export function usePending(ms: number = PENDING_MS): UsePending {
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const ref = useRef<PendingCommit | null>(null);
  if (ref.current === null) ref.current = new PendingCommit(ms, setPendingLabel);
  useEffect(() => () => ref.current?.dispose(), []);
  return {
    pendingLabel,
    arm: (label, run) => ref.current!.arm(label, run),
    cancel: () => ref.current!.cancel(),
  };
}
