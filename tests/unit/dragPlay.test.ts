/**
 * dragPlay.test.ts —— useDragPlay 纯函数层单测（node 环境，无 DOM）。
 * 命中测试、投放判定（accept/reject/miss → 分别对应打出/拽引+弹回/弹回）、
 * Magnet 吸附、拖拽阈值——这些是「命中吸附/无效弹回」手感四件的核心判定。
 */
import { describe, expect, it } from 'vitest';
import {
  exceedsDragThreshold,
  hitTestZone,
  magnetDelta,
  resolveDrop,
} from '../../src/components/cards/useDragPlay';
import type { ZoneRect } from '../../src/components/cards/useDragPlay';

const zone = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accepts = true,
): ZoneRect => ({ id, rect: { x, y, w, h }, accepts });

describe('exceedsDragThreshold（8px 以下算点按）', () => {
  it('位移 ≤8px 不算拖', () => {
    expect(exceedsDragThreshold(0, 0)).toBe(false);
    expect(exceedsDragThreshold(4, 4)).toBe(false); // √32≈5.7
    expect(exceedsDragThreshold(8, 0)).toBe(false); // 恰在阈值（严格大于才算拖）
  });
  it('位移 >8px 判拖', () => {
    expect(exceedsDragThreshold(9, 0)).toBe(true);
    expect(exceedsDragThreshold(0, -9)).toBe(true);
    expect(exceedsDragThreshold(6, 7)).toBe(true); // √85≈9.2
  });
  it('阈值可调', () => {
    expect(exceedsDragThreshold(3, 0, 2)).toBe(true);
    expect(exceedsDragThreshold(3, 0, 10)).toBe(false);
  });
});

describe('hitTestZone（矩形命中）', () => {
  const zones = [
    zone('basket', 0, 0, 100, 60),
    zone('hold', 200, 0, 100, 60),
  ];
  it('点在区内 → 返回该区', () => {
    expect(hitTestZone({ x: 50, y: 30 }, zones)?.id).toBe('basket');
    expect(hitTestZone({ x: 250, y: 30 }, zones)?.id).toBe('hold');
  });
  it('点在区外 → null', () => {
    expect(hitTestZone({ x: 150, y: 30 }, zones)).toBeNull();
    expect(hitTestZone({ x: 50, y: 80 }, zones)).toBeNull();
  });
  it('边界含在区内（含边命中）', () => {
    expect(hitTestZone({ x: 0, y: 0 }, zones)?.id).toBe('basket');
    expect(hitTestZone({ x: 100, y: 60 }, zones)?.id).toBe('basket');
  });
  it('嵌套重叠时小面积区优先', () => {
    const nested = [
      zone('big', 0, 0, 200, 200),
      zone('small', 50, 50, 40, 40),
    ];
    expect(hitTestZone({ x: 60, y: 60 }, nested)?.id).toBe('small');
    expect(hitTestZone({ x: 10, y: 10 }, nested)?.id).toBe('big');
  });
});

describe('resolveDrop（松手判定：accept=打出 / reject·miss=弹回）', () => {
  it('命中可接受区 → accept 带区 id', () => {
    const v = resolveDrop({ x: 50, y: 30 }, [zone('basket', 0, 0, 100, 60)]);
    expect(v).toEqual({ kind: 'accept', id: 'basket' });
  });
  it('命中拒收区（买不起/不可留）→ reject（拽引阻力 + 弹簧弹回）', () => {
    const v = resolveDrop({ x: 50, y: 30 }, [
      zone('basket', 0, 0, 100, 60, false),
    ]);
    expect(v.kind).toBe('reject');
  });
  it('谁的边都没碰到 → miss（弹簧弹回手牌位）', () => {
    const v = resolveDrop({ x: 500, y: 500 }, [
      zone('basket', 0, 0, 100, 60),
      zone('hold', 200, 0, 100, 60, false),
    ]);
    expect(v.kind).toBe('miss');
  });
  it('空区表 → miss', () => {
    expect(resolveDrop({ x: 0, y: 0 }, []).kind).toBe('miss');
  });
});

describe('magnetDelta（桌面指针近区吸附）', () => {
  const zones = [zone('basket', 100, 100, 100, 60)];
  it('区外 pad 范围内 → 吸向区心（位移 = 到区心距离的 1/3）', () => {
    // 区心 (150,130)；点 (150,90) 在 pad=24 外扩区内（y ≥ 100-24）
    const m = magnetDelta({ x: 150, y: 90 }, zones, 24);
    expect(m).not.toBeNull();
    expect(m!.zoneId).toBe('basket');
    expect(m!.dx).toBeCloseTo(0, 5);
    expect(m!.dy).toBeCloseTo(40 / 3, 5);
  });
  it('pad 外 → null', () => {
    expect(magnetDelta({ x: 150, y: 70 }, zones, 24)).toBeNull();
    expect(magnetDelta({ x: 70, y: 130 }, zones, 24)).toBeNull();
  });
  it('拒收区不吸附', () => {
    const rejecting = [zone('basket', 100, 100, 100, 60, false)];
    expect(magnetDelta({ x: 150, y: 90 }, rejecting, 24)).toBeNull();
  });
  it('多区命中取最近区心', () => {
    const two = [
      zone('basket', 0, 0, 100, 60),
      zone('hold', 200, 0, 100, 60),
    ];
    // 点 (190,30)：basket 区心 (50,30) 距离 140；hold 区心 (250,30) 距离 60
    const m = magnetDelta({ x: 190, y: 30 }, two, 100);
    expect(m!.zoneId).toBe('hold');
    expect(m!.dx).toBeCloseTo(60 / 3, 5);
  });
});
