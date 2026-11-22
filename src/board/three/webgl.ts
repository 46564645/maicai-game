/**
 * webgl.ts —— WebGL 能力检测（BoardMount / loadAssets 用）。
 * 2026-11-21 起 2D 回退棋盘已移除（Thong 拍板）：棋盘永远走 3D；
 * WebGL 真不可用时 BoardMount 显示错误卡 + Try again，不再降级 2D。
 * 本文件的暖机失败标记只剩 boot 缓冲页闸门的记账用途（决定缓冲页
 * 是否继续等暖机首帧），不再参与棋盘形态选择——暖机阶段的一次
 * context 丢失/超时绝不能毒化整局（3121d2c 线上实证：Edge 打开
 * 新版全程 2D，链条正是暖机失败标记 → BoardMount 直落 2D）。
 */

/** 是否支持 WebGL（webgl2 优先，退 webgl）。
 *  一次探不到不算数：GPU 进程繁忙/刚重置时首探可能假阴性，
 *  换一张新 canvas 再探一次，两次都无才判不可用。 */
export function detectWebGL(): boolean {
  for (let pass = 0; pass < 2; pass++) {
    try {
      const c = document.createElement('canvas');
      if (c.getContext('webgl2') ?? c.getContext('webgl')) return true;
    } catch {
      /* 落空继续重试一次 */
    }
  }
  return false;
}

export type BoardMode = '2d' | '3d' | 'auto';

/** 读 ?board=2d|3d|auto（历史参数；2D 棋盘移除后不再参与任何选择，
 *  仅保留解析函数供旧链接/旧测试引用，返回值不影响棋盘形态） */
export function boardMode(): BoardMode {
  const v = new URLSearchParams(window.location.search).get('board');
  return v === '2d' || v === '3d' ? v : 'auto';
}

/* 首屏暖机失败标记（src/board/three/SceneWarmup.tsx → src/boot.ts）：
   只供 boot 缓冲页闸门记账——暖机首帧超时/报错后缓冲页不再等它。
   BoardMount 自 2026-11-21 起不再读此标记：暖机失败不等于棋盘
   失败，正式棋盘永远自己新建 Canvas/context 再试一次。 */
let sceneFailed = false;

export function markBoard3DFailed(): void {
  sceneFailed = true;
}

export function board3DFailed(): boolean {
  return sceneFailed;
}
