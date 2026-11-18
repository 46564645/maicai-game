/**
 * pressInspect.ts —— R10 Slice D（interaction #4）：触屏长按检视的
 * 纯判定。长按 300ms 触发检视（卡放大 + 名签浮出）；期间手指挪过
 * INSPECT_CANCEL_PX 就当「要拖了」取消检视——与 useDragPlay 的触点
 * 阈值（18px）错开 4px，检视先让位给拖拽，两路不抢。
 */
export const LONG_PRESS_MS = 300;
export const INSPECT_CANCEL_PX = 14;

export function longPressReached(elapsedMs: number): boolean {
  return elapsedMs >= LONG_PRESS_MS;
}

/** 按住后位移超界 → 检视让位给拖拽（阈值与 exceedsDragThreshold 同形） */
export function inspectCancelled(dx: number, dy: number): boolean {
  return dx * dx + dy * dy > INSPECT_CANCEL_PX * INSPECT_CANCEL_PX;
}
