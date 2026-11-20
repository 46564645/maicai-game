/**
 * webgl.ts —— WebGL 能力检测与 3D/2D 棋盘选择（BoardMount 用）。
 * 2D 棋盘是永久兜底：检测失败、首帧看门狗超时、contextlost 都回退 2D。
 */

/** 是否支持 WebGL（webgl2 优先，退 webgl；SwiftShader 被拒时返回 false） */
export function detectWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export type BoardMode = '2d' | '3d' | 'auto';

/** 读 ?board=2d|3d|auto；未给时默认 'auto'（M4.5.3：WebGL 可用即 3D，否则 2D） */
export function boardMode(): BoardMode {
  const v = new URLSearchParams(window.location.search).get('board');
  return v === '2d' || v === '3d' ? v : 'auto';
}

/* 首屏暖机失败标记（src/board/three/SceneWarmup.tsx → src/boot.ts）：
   缓冲期场景首帧超时/报错 → 本局 3D 判不可用，BoardMount 直落 2D，
   不再让孩子等第二次 10s 看门狗。模块级、会话内有效。 */
let sceneFailed = false;

export function markBoard3DFailed(): void {
  sceneFailed = true;
}

export function board3DFailed(): boolean {
  return sceneFailed;
}
