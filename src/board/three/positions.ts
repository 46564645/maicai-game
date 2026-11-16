/**
 * positions.ts —— 3D 棋盘环形路径纯函数（无 React/three 依赖，可单测）。
 * 街道是圆角矩形的周长路径：上边 ①②（菜市场②最大）、右边 ③④、
 * 下边 ⑤⑥、左边 ⑦⑧，顺时针绕一圈（屏幕上方 = -z）。
 * 格子坐标锚点 + 同站 2×2 棋子错位的思路借自 monopoly-3d positions.ts（MIT）。
 */

/** 环路形状参数（世界单位） */
export const LOOP = {
  hx: 5.6, // 矩形半宽（x）
  hz: 3.9, // 矩形半深（z）
  r: 1.5, // 圆角半径
};

const { hx, hz, r } = LOOP;
const TOP_LEN = 2 * (hx - r); // 上/下直边长
const SIDE_LEN = 2 * (hz - r); // 左/右直边长
const ARC_LEN = (Math.PI * r) / 2; // 每个圆角弧长
export const LOOP_LENGTH = 2 * TOP_LEN + 2 * SIDE_LEN + 4 * ARC_LEN;

/** 沿环路取点：t ∈ [0,1)，返回位置与切向 yaw（0 = +x 方向） */
export function loopPoint(t: number): { x: number; z: number; yaw: number } {
  let d = (((t % 1) + 1) % 1) * LOOP_LENGTH;

  // 1. 上边：左→右（(-hx+r,-hz) → (hx-r,-hz)）
  if (d < TOP_LEN) return { x: -hx + r + d, z: -hz, yaw: 0 };
  d -= TOP_LEN;

  // 2. 右上角弧：从 -90° 转到 0°，圆心 (hx-r, -hz+r)
  if (d < ARC_LEN) {
    const a = -Math.PI / 2 + d / r;
    return { x: hx - r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r, yaw: a + Math.PI / 2 };
  }
  d -= ARC_LEN;

  // 3. 右边：上→下（(hx,-hz+r) → (hx,hz-r)）
  if (d < SIDE_LEN) return { x: hx, z: -hz + r + d, yaw: Math.PI / 2 };
  d -= SIDE_LEN;

  // 4. 右下角弧：0°→90°，圆心 (hx-r, hz-r)
  if (d < ARC_LEN) {
    const a = d / r;
    return { x: hx - r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r, yaw: a + Math.PI / 2 };
  }
  d -= ARC_LEN;

  // 5. 下边：右→左（(hx-r,hz) → (-hx+r,hz)）
  if (d < TOP_LEN) return { x: hx - r - d, z: hz, yaw: Math.PI };
  d -= TOP_LEN;

  // 6. 左下角弧：90°→180°，圆心 (-hx+r, hz-r)
  if (d < ARC_LEN) {
    const a = Math.PI / 2 + d / r;
    return { x: -hx + r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r, yaw: a + Math.PI / 2 };
  }
  d -= ARC_LEN;

  // 7. 左边：下→上（(-hx,hz-r) → (-hx,-hz+r)）
  if (d < SIDE_LEN) return { x: -hx, z: hz - r - d, yaw: -Math.PI / 2 };
  d -= SIDE_LEN;

  // 8. 左上角弧：180°→270°，圆心 (-hx+r, -hz+r)
  const a = Math.PI + d / r;
  return { x: -hx + r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r, yaw: a + Math.PI / 2 };
}

/** 8 个站点在环路上的 t 值（顺时针：①②上、③④右、⑤⑥下、⑦⑧左） */
export function stationT(index: number): number {
  const top = TOP_LEN / LOOP_LENGTH;
  const side = SIDE_LEN / LOOP_LENGTH;
  const arc = ARC_LEN / LOOP_LENGTH;
  const u = index % 8;
  if (u <= 1) return top * (0.32 + 0.36 * u); // ①② 上边
  if (u <= 3) return top + arc + side * (0.32 + 0.36 * (u - 2)); // ③④ 右边
  if (u <= 5) return top + arc + side + arc + top * (0.32 + 0.36 * (u - 4)); // ⑤⑥ 下边（右→左）
  return top + arc + side + arc + top + arc + side * (0.32 + 0.36 * (u - 6)); // ⑦⑧ 左边（下→上）
}

/** 站点 index（0..7）的世界坐标锚点 */
export function stationAnchor(index: number): { x: number; z: number; yaw: number } {
  return loopPoint(stationT(index));
}

const SLOT = 0.34;
/** 同站 4 枚棋子的 2×2 错位（相对站心的局部偏移，沿街道朝向旋转） */
export function pawnSlotOffset(slot: number): { dx: number; dz: number } {
  const s = ((slot % 4) + 4) % 4;
  return { dx: (s % 2 === 0 ? -SLOT : SLOT), dz: (s < 2 ? -SLOT : SLOT) };
}

/** 棋子世界坐标：站心 + 按站朝向旋转后的错位 */
export function pawnAnchor(index: number, slot: number): { x: number; z: number } {
  const c = stationAnchor(index);
  const o = pawnSlotOffset(slot);
  const cos = Math.cos(c.yaw);
  const sin = Math.sin(c.yaw);
  return { x: c.x + o.dx * cos - o.dz * sin, z: c.z + o.dx * sin + o.dz * cos };
}

/**
 * 站点 index 之后（到下一站之前）的过渡地砖 t 值列表。
 * 按弧长自动取 2–3 块（过弯的缝更长就多放一块）。
 */
export function transitionTs(index: number): number[] {
  const t0 = stationT(index);
  const t1 = stationT((index + 1) % 8);
  const gap = t1 > t0 ? t1 - t0 : t1 + 1 - t0; // 跨 0 点的缝
  const arcDist = gap * LOOP_LENGTH;
  const count = Math.min(3, Math.max(2, Math.round(arcDist / 1.35) - 1));
  return Array.from({ length: count }, (_, i) => (t0 + (gap * (i + 1)) / (count + 1)) % 1);
}

/** 站点「街外侧」方向（从岛心指向站点外，道具摆在这一侧、面向街道） */
export function stationOutward(index: number): { x: number; z: number } {
  const a = stationAnchor(index);
  const len = Math.hypot(a.x, a.z) || 1;
  return { x: a.x / len, z: a.z / len };
}

/**
 * 道具锚点：站心沿外向推出 dist；返回的 yaw 使模型 +z 面朝向街道/岛心
 * （rotation.y = yaw 时，模型正面 (0,0,1) 指向 -outward）。
 */
export function propAnchor(
  index: number,
  dist: number,
): { x: number; z: number; yaw: number } {
  const a = stationAnchor(index);
  const n = stationOutward(index);
  return { x: a.x + n.x * dist, z: a.z + n.z * dist, yaw: Math.atan2(-n.x, -n.z) };
}

/** 走站弧跳姿态：k∈[0,1]，from→to 抛物线跳 + 末尾落地压扁回弹（ART_3D §8.3） */
export interface HopPose {
  x: number;
  z: number;
  y: number; // 离地高度（0 = 贴地）
  yaw: number; // 朝向行进方向
  scaleY: number; // 纵向缩放（空中微拉、落地压扁）
  scaleXZ: number; // 横向补偿（体积守恒的玩具感）
}

const MOVE_END = 0.76; // 前 76% 是空中位移，余下时间做落地回弹

export function hopPose(
  from: { x: number; z: number },
  to: { x: number; z: number },
  k: number,
  height = 1.15,
): HopPose {
  const move = Math.min(1, Math.max(0, k / MOVE_END));
  const e = move * move * (3 - 2 * move); // smoothstep 缓入缓出
  const y = height * 4 * move * (1 - move);
  let scaleY = 1;
  if (move > 0.06 && move < 0.94) scaleY = 1.08; // 空中微微拉长
  if (move >= 1) {
    const s = Math.min(1, (k - MOVE_END) / (1 - MOVE_END));
    scaleY = 1 - 0.34 * Math.sin(Math.PI * s) * (1 - s * 0.3); // 压扁再弹回
  }
  return {
    x: from.x + (to.x - from.x) * e,
    z: from.z + (to.z - from.z) * e,
    y,
    yaw: Math.atan2(to.x - from.x, to.z - from.z),
    scaleY,
    scaleXZ: 1 + (1 - scaleY) * 0.9,
  };
}
