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

/** 节流环境动效：每 tickMs 更新一次姿态并请求渲染一帧 */
export function useAmbient(tickMs: number, fn: (t: number) => void): void {
  const last = useRef(-1);
  useFrame(({ clock, invalidate }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    if (t - last.current < tickMs / 1000) return;
    last.current = t;
    fn(t);
    invalidate();
  });
}
