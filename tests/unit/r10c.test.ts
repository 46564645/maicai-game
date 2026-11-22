/**
 * r10c.test.ts —— R10 Slice C 五镜头优化轮单测。
 *
 * finding 1（motion #1）CoinCounter 不过冲缓动 + 个位 40ms 错峰——
 *   node 环境无 DOM，改为对交付 CSS 做验收断言（曲线 token、
 *   数字条引用、错峰 delay 都在样式表里落了才算数）。
 * finding 2（motion #2）常驻动画预算：可打光晕静态化、foil 一次性、
 *   bot 思考脉冲只动 opacity。
 * finding 5（interaction #1）触点起拖阈值 + tap-rescue 纯函数。
 * finding 6（interaction #2）PendingCommit 后悔窗口：挂起/撤销/到期派发。
 * finding 14（motion #3）reduced-motion 只禁循环、不全局清零时长。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// 仓库未装 @types/node（vitest 运行时本就有 node:fs）：CSS 验收断言
// 直接读源文件字符串；相对路径以项目根为 cwd（npm run test 的约定）
// @ts-expect-error —— node 环境内置模块，无类型声明
import { readFileSync } from 'node:fs';
import {
  DRAG_THRESHOLD_MOUSE,
  DRAG_THRESHOLD_TOUCH,
  TAP_RESCUE_DIST,
  TAP_RESCUE_MS,
  dragThresholdFor,
  isTapRescue,
} from '../../src/components/cards/useDragPlay';
import { PENDING_MS, PendingCommit } from '../../src/components/cards/pendingCommit';

const readSrc = (rel: string) => readFileSync(`src/${rel}`, 'utf8');
const cardsCss = readSrc('components/cards/cards.css');
const tokensCss = readSrc('theme/tokens.css');
const boardCss = readSrc('board.css');
const baseCss = readSrc('theme/base.css');

/** 取选择器第一个 {} 块内文本（CSS 验收断言用） */
function cssBlock(css: string, selector: string): string {
  const i = css.indexOf(selector);
  expect(i, `缺少选择器 ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

describe('finding 1：CoinCounter 绝不闪出错的数字', () => {
  it('--ease-roll 是不带回退的不过冲曲线', () => {
    expect(tokensCss).toContain(
      '--ease-roll: cubic-bezier(0.23, 1, 0.32, 1)',
    );
  });
  it('数字条用 --ease-roll 滚动（不再借 --ease-spring 过冲）', () => {
    const block = cssBlock(cardsCss, '.cc-strip {');
    expect(block).toContain('var(--ease-roll)');
    expect(block).not.toContain('--ease-spring');
  });
  it('个位列晚 40ms 起步（设计承诺的错峰滚动）', () => {
    const block = cssBlock(cardsCss, '.cc-col--ones .cc-strip');
    expect(block).toContain('transition-delay: 40ms');
  });
});

describe('finding 2：同屏常驻动画预算（至多一点在动）', () => {
  it('可打光晕是静态描边+静态黄晕，无 animation 声明', () => {
    const block = cssBlock(cardsCss, '.pglow--on {');
    expect(block).not.toContain('animation');
    expect(block).toContain('var(--color-ink)'); // 墨描边：非 colour-only 信号
  });
  it('foil 扫光是一次性 transform 扫过（1 次 + forwards）', () => {
    const block = cssBlock(cardsCss, '.tc-foil {');
    expect(block).toMatch(/animation:\s*tc-foil-sweep[^;]*\s1\s+forwards/);
    expect(block).not.toContain('infinite');
  });
  it('bot 思考光圈 = 静态柔光环（glow 体系，无 animation）', () => {
    // F33（WS5）：呼吸脉动的光圈换成 Border Glow 体系的静态柔光环——
    // 常驻动画预算（同屏至多一个在动）本就不该花在光圈上
    const block = cssBlock(boardCss, '.bot-card--thinking::after {');
    expect(block).toContain('var(--glow-amber)');
    expect(block).toContain('var(--color-ink)');
    expect(block).not.toContain('animation');
    expect(boardCss).not.toContain('@keyframes think-halo');
  });
});

describe('finding 5：触点起拖阈值 + tap-rescue', () => {
  it('鼠标阈值保持 8px', () => {
    expect(DRAG_THRESHOLD_MOUSE).toBe(8);
    expect(dragThresholdFor('mouse')).toBe(8);
  });
  it('触屏/触笔/未知指针放宽到 18px', () => {
    expect(DRAG_THRESHOLD_TOUCH).toBe(18);
    expect(dragThresholdFor('touch')).toBe(18);
    expect(dragThresholdFor('pen')).toBe(18);
    expect(dragThresholdFor('')).toBe(18); // 未上报指针按触屏安全值
  });
  it('tap-rescue：小位移 + 短时长仍算点按', () => {
    expect(TAP_RESCUE_DIST).toBe(26);
    expect(TAP_RESCUE_MS).toBe(300);
    expect(isTapRescue(0, 0, 0)).toBe(true);
    expect(isTapRescue(20, 0, 200)).toBe(true);
    expect(isTapRescue(18, 18, 100)).toBe(true); // √648≈25.5 < 26
  });
  it('tap-rescue 边界：过距或超时即真拖', () => {
    expect(isTapRescue(26, 0, 100)).toBe(false); // 恰在边界（严格小于）
    expect(isTapRescue(10, 0, 300)).toBe(false); // 按太久（按住犹豫≠点按）
    expect(isTapRescue(40, 0, 100)).toBe(false); // 明显拖出
  });
});

describe('finding 6：后悔窗口（钱/答案 commit 前可撤销）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('挂起期间暴露标签，到期才真正派发', () => {
    const fired: string[] = [];
    const seen: (string | null)[] = [];
    const pc = new PendingCommit(PENDING_MS, (l) => seen.push(l));
    expect(pc.pendingLabel).toBeNull();
    expect(pc.arm('鸡蛋 ×1', () => fired.push('buy'))).toBe(true);
    expect(pc.pendingLabel).toBe('鸡蛋 ×1');
    expect(fired).toEqual([]); // 窗口内：还没花出去
    vi.advanceTimersByTime(PENDING_MS - 1);
    expect(fired).toEqual([]); // 最后一毫秒仍可撤
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['buy']); // 窗口结束才到账
    expect(pc.pendingLabel).toBeNull();
    expect(seen).toEqual(['鸡蛋 ×1', null]);
  });

  it('窗口内撤销 → 永不派发', () => {
    const fired: string[] = [];
    const pc = new PendingCommit(1000);
    pc.arm('x', () => fired.push('x'));
    expect(pc.cancel()).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(fired).toEqual([]);
    expect(pc.pendingLabel).toBeNull();
    expect(pc.cancel()).toBe(false); // 没有第二笔可撤
  });

  it('同一窗口拒绝叠发；落地后才能挂下一笔', () => {
    const fired: string[] = [];
    const pc = new PendingCommit(1000);
    expect(pc.arm('a', () => fired.push('a'))).toBe(true);
    expect(pc.arm('b', () => fired.push('b'))).toBe(false); // 拒绝叠发
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual(['a']); // 只有第一笔
    expect(pc.arm('b', () => fired.push('b'))).toBe(true); // 落地后可再挂
    vi.advanceTimersByTime(1000);
    expect(fired).toEqual(['a', 'b']);
  });

  it('dispose 清掉未派发的挂起', () => {
    const fired: string[] = [];
    const pc = new PendingCommit(1000);
    pc.arm('a', () => fired.push('a'));
    pc.dispose();
    vi.advanceTimersByTime(2000);
    expect(fired).toEqual([]);
  });
});

describe('finding 14：reduced-motion 温和降级', () => {
  it('不再把所有动画时长压成 0.01ms（语义过渡保留 120ms）', () => {
    expect(baseCss).not.toMatch(/(animation|transition)-duration:\s*0\.01ms/);
    // 组件级 120ms 语义过渡仍在（不再被全局清零盖掉）
    expect(cardsCss).toContain('120ms');
  });
  it('全局规则只压掉循环（iteration-count:1）与结构装饰动画', () => {
    const reduce = baseCss.slice(baseCss.indexOf('prefers-reduced-motion'));
    expect(reduce).toContain('animation-iteration-count: 1 !important');
    expect(reduce).not.toContain('animation-duration');
    expect(reduce).not.toContain('transition-duration');
  });
});
