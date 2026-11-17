/**
 * fitSolver.test.ts —— R8 自适应取景求解器（RESPONSIVE_R8.md）。
 *
 * 每个验收视口一组：自由矩形取自 R8 后的实测 chrome（harness
 * shots/r8-capture.mjs 的 free 字段口径：桌面 = bot 列内缘 × 顶条
 * 下沿 → 底部栈顶；手机 = 头像排下沿 → 圆钮顶、右到竖栏左缘）。
 * 断言钉住口径：填充（FIT_BOUNDS rim 投影 ÷ 自由矩形）落 0.60–0.70
 * 带内；rim 在自由矩形内（整岛不钻面板）；rim 在视口内（整岛入画）。
 * 参考视口另断言与 R5 实测相符（桌面 d≈42.9、手机 d≈36.7、填充
 * ≈0.662/0.665，容差内不回退）。
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { solveFit, type FreeRect } from '../../src/board/three/fitSolver';

const DIR = new THREE.Vector3(0, 21, 18).normalize();
const MIX = { desktop: 0.12, compact: 0.05 };

interface Case {
  name: string;
  w: number;
  h: number;
  phone: boolean;
  free: FreeRect;
}

const CASES: Case[] = [
  { name: 'phone-844x390', w: 844, h: 390, phone: true, free: { x: 0, y: 56, w: 591, h: 270 } },
  { name: 'phone-874x402', w: 874, h: 402, phone: true, free: { x: 0, y: 56, w: 612, h: 282 } },
  { name: 'phone-915x412', w: 915, h: 412, phone: true, free: { x: 0, y: 56, w: 640, h: 292 } },
  { name: 'phone-740x360', w: 740, h: 360, phone: true, free: { x: 0, y: 56, w: 490, h: 240 } },
  { name: 'desktop-1024x768', w: 1024, h: 768, phone: false, free: { x: 184, y: 72, w: 656, h: 503 } },
  { name: 'desktop-1280x800', w: 1280, h: 800, phone: false, free: { x: 206, y: 72, w: 868, h: 539 } },
  { name: 'desktop-1440x900', w: 1440, h: 900, phone: false, free: { x: 270, y: 72, w: 900, h: 639 } },
  { name: 'desktop-1600x1000', w: 1600, h: 1000, phone: false, free: { x: 206, y: 72, w: 1188, h: 739 } },
  { name: 'desktop-1920x1080', w: 1920, h: 1080, phone: false, free: { x: 350, y: 72, w: 1220, h: 807 } },
];

describe('solveFit — R8 验收视口矩阵', () => {
  for (const c of CASES) {
    it(`${c.name}: 填充 0.60–0.70、rim 在自由矩形与视口内`, () => {
      const r = solveFit({
        width: c.w,
        height: c.h,
        free: c.free,
        mix: c.phone ? MIX.compact : MIX.desktop,
        dir: DIR,
      });
      expect(r.fill).toBeGreaterThanOrEqual(0.6);
      expect(r.fill).toBeLessThanOrEqual(0.7);
      // rim 在自由矩形内（1.5px 容差）→ 整岛不钻面板
      expect(r.rim.x).toBeGreaterThanOrEqual(c.free.x - 1.5);
      expect(r.rim.y).toBeGreaterThanOrEqual(c.free.y - 1.5);
      expect(r.rim.x + r.rim.w).toBeLessThanOrEqual(c.free.x + c.free.w + 1.5);
      expect(r.rim.y + r.rim.h).toBeLessThanOrEqual(c.free.y + c.free.h + 1.5);
      // 整岛入画
      expect(r.rim.x).toBeGreaterThanOrEqual(-1.5);
      expect(r.rim.y).toBeGreaterThanOrEqual(-1.5);
      expect(r.rim.x + r.rim.w).toBeLessThanOrEqual(c.w + 1.5);
      expect(r.rim.y + r.rim.h).toBeLessThanOrEqual(c.h + 1.5);
    });
  }

  it('参考视口不回退：1280×800 桌面 d≈42.9、填充≈0.662', () => {
    const r = solveFit({
      width: 1280,
      height: 800,
      free: { x: 206, y: 72, w: 868, h: 539 },
      mix: MIX.desktop,
      dir: DIR,
    });
    expect(Math.abs(r.distance - 42.9)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(r.fill - 0.662)).toBeLessThanOrEqual(0.01);
  });

  it('参考视口不回退：874×402 手机 d≈36.7、填充≈0.665', () => {
    const r = solveFit({
      width: 874,
      height: 402,
      free: { x: 0, y: 56, w: 612, h: 282 },
      mix: MIX.compact,
      dir: DIR,
    });
    expect(Math.abs(r.distance - 36.7)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(r.fill - 0.665)).toBeLessThanOrEqual(0.01);
  });

  it('退化自由矩形不抛错、回兜底', () => {
    const r = solveFit({
      width: 1280,
      height: 800,
      free: { x: 0, y: 0, w: 0, h: 0 },
      mix: MIX.desktop,
      dir: DIR,
    });
    expect(r.distance).toBeGreaterThan(0);
  });

  it('确定性：同输入同输出', () => {
    const args = {
      width: 1440,
      height: 900,
      free: { x: 270, y: 72, w: 900, h: 639 },
      mix: MIX.desktop,
      dir: DIR,
    };
    const a = solveFit(args);
    const b = solveFit(args);
    expect(a.distance).toBe(b.distance);
    expect(a.fill).toBe(b.fill);
    expect(a.base.x).toBe(b.base.x);
    expect(a.base.z).toBe(b.base.z);
  });
});
