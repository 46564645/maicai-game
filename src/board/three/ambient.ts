/**
 * ambient.ts —— 环境微动效公共约定（ART_3D §8.6 场景要有点「活」）。
 * frameloop="demand" 下每个动效各自 useFrame 并内部节流（默认 ~15fps），
 * 同一帧的 invalidate 会合并——整场景以低帧率「呼吸」，不空耗 GPU。
 * prefers-reduced-motion 时所有环境动效静止。
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* R10E（e2e 修复）：?fast=1（e2e/截图驱动标志）下冻结环境微动效——
   软渲染每帧数秒，~15fps 的持续 invalidate 会把主线程钉死，
   Playwright 的 actionability 永远等不到。树/云定在某帧姿态，
   截图不受影响；真实游玩无此参数，照旧呼吸。 */
export const fastMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('fast') === '1';

/** 节流环境动效：每 tickMs 更新一次姿态并请求渲染一帧 */
export function useAmbient(tickMs: number, fn: (t: number) => void): void {
  const last = useRef(-1);
  useFrame(({ clock, invalidate }) => {
    if (reducedMotion || fastMode) return;
    const t = clock.elapsedTime;
    if (t - last.current < tickMs / 1000) return;
    last.current = t;
    fn(t);
    invalidate();
  });
}
