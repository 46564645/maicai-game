/**
 * fitSolver.ts —— R8 自适应取景求解器（纯函数，无 DOM、无 React）。
 *
 * 取代 R5 的 FIT_RECT/FIT_SHIFT 分档常量：给定画布尺寸与「自由矩形」
 * （视口减去真实 DOM chrome 的矩形，由 CameraRig 实测传入），求：
 *   1. 注视基点 base —— 让小岛外廓（FIT_BOUNDS）投影包围盒在自由
 *      矩形内居中（数值雅可比固定点迭代，取代手工 FIT_SHIFT）；
 *   2. 机位距离 d —— 让包围盒面积 = FILL_TARGET × 自由矩形面积
 *      （二分；填充率口径与 ART_R5 钉住口径一致：FIT_BOUNDS rim
 *      bbox ÷ 自由带面积，目标带 0.60–0.70，取 0.66）；
 *   3. 跟随约束 —— 全部跟随目标（base + mix × 站点锚点）下 8 个外廓
 *      角都必须留在自由矩形内；若目标填充下越界，二分放大 d 直到
 *      满足（填充随之略降，但整岛永不钻进面板下）。
 * 相机方向（DEFAULT_POS 方向）与 FOV 27 不变（ART_3D §9.2）。
 */
import * as THREE from 'three';
import { stationAnchor } from './positions';

export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FitResult {
  distance: number;
  /** 取景基线（默认/跟随目标的公共原点，y 恒为 0） */
  base: THREE.Vector3;
  /** base 目标下 FIT_BOUNDS 的投影包围盒（画布像素） */
  rim: { x: number; y: number; w: number; h: number };
  /** rim 面积 ÷ 自由矩形面积（钉住口径） */
  fill: number;
}

/** 小岛外廓：浅滩沿 ±8.55×±6.65、含 rim 树高 1.7（T5 起沿用） */
export const FIT_BOUNDS = { x: 8.55, z: 6.65, top: 1.7 };
/** 填充目标：0.60–0.70 带中部（R5 实测桌面 0.662 / 手机 0.665） */
export const FILL_TARGET = 0.66;

const FOV = 27;
const D_MIN = 14;
const D_MAX = 90;

const CORNERS: THREE.Vector3[] = [];
for (const sx of [-1, 1])
  for (const sz of [-1, 1]) {
    CORNERS.push(new THREE.Vector3(sx * FIT_BOUNDS.x, 0, sz * FIT_BOUNDS.z));
    CORNERS.push(new THREE.Vector3(sx * FIT_BOUNDS.x, FIT_BOUNDS.top, sz * FIT_BOUNDS.z));
  }

interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function projectBbox(
  cam: THREE.PerspectiveCamera,
  base: THREE.Vector3,
  dir: THREE.Vector3,
  d: number,
  goal: THREE.Vector3,
  w: number,
  h: number,
): Bbox {
  cam.position.copy(base).addScaledVector(dir, d);
  cam.lookAt(goal);
  cam.updateMatrixWorld();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const v = new THREE.Vector3();
  for (const c of CORNERS) {
    v.copy(c).project(cam);
    const px = ((v.x + 1) / 2) * w;
    const py = ((1 - v.y) / 2) * h;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** 全部外廓角在全部跟随目标下都落进自由矩形（1px 容差） */
function fitsAllGoals(
  cam: THREE.PerspectiveCamera,
  base: THREE.Vector3,
  dir: THREE.Vector3,
  d: number,
  goals: THREE.Vector3[],
  free: FreeRect,
  w: number,
  h: number,
): boolean {
  const v = new THREE.Vector3();
  cam.position.copy(base).addScaledVector(dir, d);
  for (const g of goals) {
    cam.lookAt(g);
    cam.updateMatrixWorld();
    for (const c of CORNERS) {
      v.copy(c).project(cam);
      const px = ((v.x + 1) / 2) * w;
      const py = ((1 - v.y) / 2) * h;
      if (px < free.x - 1 || px > free.x + free.w + 1) return false;
      if (py < free.y - 1 || py > free.y + free.h + 1) return false;
    }
  }
  return true;
}

export function solveFit(opts: {
  /** 画布像素尺寸（= 视口，画布 fixed 铺满） */
  width: number;
  height: number;
  /** 自由矩形（画布像素坐标） */
  free: FreeRect;
  /** 跟随混合比（FOLLOW_MIX，按档位） */
  mix: number;
  /** 相机方向（DEFAULT_POS 归一化） */
  dir: THREE.Vector3;
  target?: number;
}): FitResult {
  const { width: w, height: h, free, mix, dir } = opts;
  const target = opts.target ?? FILL_TARGET;
  const fallbackBase = new THREE.Vector3(0, 0, 0.4);
  if (!(free.w > 40) || !(free.h > 40) || !(w > 0) || !(h > 0)) {
    return { distance: 43, base: fallbackBase, rim: { x: 0, y: 0, w: 0, h: 0 }, fill: 0 };
  }
  const cam = new THREE.PerspectiveCamera(FOV, Math.max(0.5, w / h), 0.5, 400);
  const freeCx = free.x + free.w / 2;
  const freeCy = free.y + free.h / 2;
  const freeArea = free.w * free.h;

  /**
   * 居中求解：调 base.x/base.z 让 base 目标下包围盒中心与自由矩形
   * 中心重合。数值雅可比 + 固定点迭代（每步限幅 ±2 世界单位）。
   */
  const centerBase = (d: number, start: THREE.Vector3): THREE.Vector3 => {
    const base = start.clone();
    for (let iter = 0; iter < 6; iter++) {
      const bb = projectBbox(cam, base, dir, d, base, w, h);
      const ex = bb.x + bb.w / 2 - freeCx;
      const ey = bb.y + bb.h / 2 - freeCy;
      if (Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) break;
      const DELTA = 0.25;
      const bx = base.clone();
      bx.x += DELTA;
      const bbX = projectBbox(cam, bx, dir, d, bx, w, h);
      const bz = base.clone();
      bz.z += DELTA;
      const bbZ = projectBbox(cam, bz, dir, d, bz, w, h);
      // 雅可比：列 = base.x / base.z 单位移动引起的包围盒中心位移
      const j00 = (bbX.x + bbX.w / 2 - (bb.x + bb.w / 2)) / DELTA;
      const j10 = (bbX.y + bbX.h / 2 - (bb.y + bb.h / 2)) / DELTA;
      const j01 = (bbZ.x + bbZ.w / 2 - (bb.x + bb.w / 2)) / DELTA;
      const j11 = (bbZ.y + bbZ.h / 2 - (bb.y + bb.h / 2)) / DELTA;
      const det = j00 * j11 - j01 * j10;
      if (Math.abs(det) < 1e-6) break;
      let dx = (-ex * j11 + ey * j01) / det;
      let dz = (-j00 * ey + j10 * ex) / det;
      dx = THREE.MathUtils.clamp(dx, -2, 2);
      dz = THREE.MathUtils.clamp(dz, -2, 2);
      base.x += dx;
      base.z += dz;
    }
    return base;
  };

  const fillAt = (d: number): { fill: number; base: THREE.Vector3; rim: Bbox } => {
    const base = centerBase(d, fallbackBase);
    const rim = projectBbox(cam, base, dir, d, base, w, h);
    return { fill: (rim.w * rim.h) / freeArea, base, rim };
  };

  // 1) 按填充目标二分距离（填充随 d 单调递减）
  let d: number;
  const fMin = fillAt(D_MIN).fill;
  const fMax = fillAt(D_MAX).fill;
  if (fMin <= target) {
    d = D_MIN;
  } else if (fMax >= target) {
    d = D_MAX;
  } else {
    let lo = D_MIN;
    let hi = D_MAX;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      if (fillAt(mid).fill > target) lo = mid;
      else hi = mid;
    }
    d = hi;
  }

  // 2) 跟随约束：任一跟随目标下角越界 → 放大 d 直到全满足。
  // fitsAt(d)：在该 d 的居中 base 下重建全部跟随目标再验（含 base 本身）。
  const fitsAt = (dd: number): boolean => {
    const b = centerBase(dd, fallbackBase);
    const goals: THREE.Vector3[] = [b.clone()];
    for (let i = 0; i < 8; i++) {
      const a = stationAnchor(i);
      goals.push(new THREE.Vector3(a.x * mix + b.x, 0, a.z * mix + b.z));
    }
    return fitsAllGoals(cam, b, dir, dd, goals, free, w, h);
  };
  if (!fitsAt(d)) {
    if (fitsAt(D_MAX)) {
      let lo = d;
      let hi = D_MAX;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (fitsAt(mid)) hi = mid;
        else lo = mid;
      }
      d = hi;
    } else {
      d = D_MAX;
    }
  }
  const solved = fillAt(d);

  return { distance: d, base: solved.base, rim: solved.rim, fill: solved.fill };
}
