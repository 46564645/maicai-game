/**
 * spinMath.ts —— 天气转盘的角度纯函数（无 React/three 依赖，可单测）。
 * 结果由引擎先定（turn.sub.weatherId），3D 只负责演出：
 * 「算目标角 + 加整圈 + 指数缓停」借 closing-quest roulette.ts（MIT）的写法。
 * 约定：盘面分区 i 的中心画在「自顶端顺时针 i×seg 度」（canvas 顶=-90°），
 * 固定指针在 -z（顶端）；rotation.y = -rad(angle) 时 angle 增大盘面顺时针走。
 */

export function mod360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** 让分区 index 的中心停到指针下的盘面角度（度，mod 360） */
export function sectorTargetAngle(index: number, count: number): number {
  return mod360(-index * (360 / count));
}

/** 从 fromDeg 往前（顺时针）转到 toDeg 需要的角度差（0..360） */
export function forwardDelta(fromDeg: number, toDeg: number): number {
  return (mod360(toDeg) - mod360(fromDeg) + 360) % 360;
}

/**
 * 指数缓停插值：k(t) = (1-e^{-t/τ}) / (1-e^{-dur/τ})，τ=dur/6。
 * 起步快、停得柔（closing-quest 同款曲线）；t∈[0,dur] → from+total·k。
 */
export function spinAngleAt(from: number, total: number, t: number, dur: number): number {
  const tt = Math.min(Math.max(t, 0), dur);
  const tau = dur / 6;
  const k = (1 - Math.exp(-tt / tau)) / (1 - Math.exp(-dur / tau));
  return from + total * k;
}
