/**
 * spinMath 单测：天气转盘「结果先定只演出」的角度约定。
 */
import { describe, expect, it } from 'vitest';
import { forwardDelta, mod360, sectorTargetAngle, spinAngleAt } from '../../src/board/three/spinMath';

describe('spinMath', () => {
  it('sectorTargetAngle：分区 i 的目标角 = -i·seg（mod 360）', () => {
    expect(sectorTargetAngle(0, 3)).toBe(0);
    expect(sectorTargetAngle(1, 3)).toBe(240);
    expect(sectorTargetAngle(2, 3)).toBe(120);
  });

  it('forwardDelta 恒为前向（0..360），同角得 0', () => {
    expect(forwardDelta(0, 0)).toBe(0);
    expect(forwardDelta(350, 10)).toBe(20);
    expect(forwardDelta(10, 350)).toBe(340);
    expect(forwardDelta(-30, 240)).toBe(270);
  });

  it('spinAngleAt：端点精确、起点不动、单调不减', () => {
    const from = 45;
    const total = 900;
    const dur = 1.05;
    expect(spinAngleAt(from, total, 0, dur)).toBeCloseTo(from, 10);
    expect(spinAngleAt(from, total, dur, dur)).toBeCloseTo(from + total, 10);
    expect(spinAngleAt(from, total, dur * 2, dur)).toBeCloseTo(from + total, 10);
    let prev = -Infinity;
    for (let i = 0; i <= 20; i++) {
      const a = spinAngleAt(from, total, (dur * i) / 20, dur);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('mod360 处理负角与超圈', () => {
    expect(mod360(-120)).toBe(240);
    expect(mod360(720)).toBe(0);
    expect(mod360(845)).toBe(125);
  });
});
