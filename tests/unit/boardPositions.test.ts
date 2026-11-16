/**
 * boardPositions.test.ts —— 3D 棋盘路径/站位/弧跳纯函数单测（M4.5.2）。
 * positions.ts 无 three/React 依赖，直接在 node 环境跑。
 */
import { describe, expect, it } from 'vitest';
import {
  LOOP_LENGTH,
  hopPose,
  loopPoint,
  pawnAnchor,
  pawnSlotOffset,
  propAnchor,
  stationAnchor,
  stationOutward,
  stationT,
  transitionTs,
} from '../../src/board/three/positions';

describe('loopPoint / stationT', () => {
  it('环路总长为正，t=0 与 t=1 同点', () => {
    expect(LOOP_LENGTH).toBeGreaterThan(0);
    const a = loopPoint(0);
    const b = loopPoint(0.9999);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.1);
  });

  it('8 个站点 t 单调递增且都在 [0,1)', () => {
    let prev = -1;
    for (let i = 0; i < 8; i++) {
      const t = stationT(i);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(1);
      expect(t).toBeGreaterThan(prev);
      prev = t;
    }
  });

  it('站点锚点两两不重叠', () => {
    for (let i = 0; i < 8; i++) {
      for (let j = i + 1; j < 8; j++) {
        const a = stationAnchor(i);
        const b = stationAnchor(j);
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1.5);
      }
    }
  });
});

describe('pawnAnchor / transitionTs', () => {
  it('同站 4 个站位互不重叠', () => {
    for (let s = 0; s < 8; s++) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const a = pawnAnchor(s, i);
          const b = pawnAnchor(s, j);
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.5);
        }
      }
    }
    expect(pawnSlotOffset(4)).toEqual(pawnSlotOffset(0)); // slot 取模安全
  });

  it('相邻站之间放 2–3 块过渡砖', () => {
    for (let i = 0; i < 8; i++) {
      const ts = transitionTs(i);
      expect(ts.length).toBeGreaterThanOrEqual(2);
      expect(ts.length).toBeLessThanOrEqual(3);
      for (const t of ts) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(1);
      }
    }
  });
});

describe('propAnchor / stationOutward', () => {
  it('道具摆在站点外侧且朝向街道', () => {
    for (let i = 0; i < 8; i++) {
      const a = stationAnchor(i);
      const n = stationOutward(i);
      expect(Math.hypot(n.x, n.z)).toBeCloseTo(1, 3);
      const p = propAnchor(i, 1);
      // 比站心更远离岛心
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(Math.hypot(a.x, a.z));
      // 面向街道：prop → 站心方向应与 +z 旋转后一致
      const dx = a.x - p.x;
      const dz = a.z - p.z;
      expect(Math.atan2(dx, dz)).toBeCloseTo(p.yaw, 5);
    }
  });
});

describe('hopPose 走站弧跳', () => {
  const from = { x: 0, z: 0 };
  const to = { x: 3, z: 2 };

  it('起点贴地出发、终点贴地落下', () => {
    const a = hopPose(from, to, 0);
    expect(a.x).toBeCloseTo(0);
    expect(a.z).toBeCloseTo(0);
    expect(a.y).toBeCloseTo(0);
    const b = hopPose(from, to, 1);
    expect(b.x).toBeCloseTo(3);
    expect(b.z).toBeCloseTo(2);
    expect(b.y).toBeCloseTo(0);
    expect(b.scaleY).toBeCloseTo(1, 1);
  });

  it('中段离地成抛物线、空中微拉长', () => {
    const mid = hopPose(from, to, 0.38);
    expect(mid.y).toBeGreaterThan(0.5);
    expect(mid.scaleY).toBeGreaterThan(1);
  });

  it('落地瞬间压扁（scaleY<1）再弹回', () => {
    const squash = hopPose(from, to, 0.88);
    expect(squash.scaleY).toBeLessThan(1);
    expect(squash.scaleXZ).toBeGreaterThan(1);
    const settled = hopPose(from, to, 1);
    expect(settled.scaleY).toBeCloseTo(1, 1);
  });

  it('朝向行进方向', () => {
    const p = hopPose(from, to, 0.5);
    expect(p.yaw).toBeCloseTo(Math.atan2(3, 2), 5);
  });
});
