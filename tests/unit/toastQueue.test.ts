/**
 * toastQueue.test.ts —— toast-4s 提示条改版单测。
 *
 * 纯函数层（src/ui/toastQueue.ts）：
 *   isBotActionEntry      bot 动作判定（真人/系统/AI 台词都不算）
 *   enqueueToastEntries   排队保序 + 连续 bot 动作合并成一条组合行 +
 *                         合并上限（TOAST_MERGE_MAX）+ 并入队尾 rev+1
 * 源码/CSS 断言（沿 r1e 体例，readFileSync）：
 *   dwell 定稿 4000ms（Toast.tsx 常量与 tokens.css 变量同值）
 *   组件一次只渲染队首一条（items[0]），不叠条
 *   点按即关走 button + onClick，点击区 ≥48px（--tap-min-size）
 *   条本体 pointer-events:auto、stack 层仍 none（不挡条外按钮）
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error —— vitest 运行时是 node，内置模块无类型声明
import { readFileSync } from 'node:fs';
import {
  enqueueToastEntries,
  isBotActionEntry,
  TOAST_MERGE_MAX,
} from '../../src/ui/toastQueue';
import type { LogEntry } from '../../src/game/types';

const readSrc = (rel: string) => readFileSync(`src/${rel}`, 'utf8');
const toastTsx = readSrc('components/Toast.tsx');
const hudCss = readSrc('hud.css');
const tokensCss = readSrc('theme/tokens.css');
const gameTsx = readSrc('screens/Game.tsx');

const HUMAN = 'p-human';
const BOT = 'p-bot';

const entry = (
  id: number,
  playerId?: string,
  extra: Partial<LogEntry> = {},
): LogEntry => ({ id, text: `log ${id}`, playerId, ...extra }) as LogEntry;

const texts = (items: { texts: string[] }[]) => items.map((i) => i.texts);

/* ============ bot 动作判定 ============ */
describe('isBotActionEntry', () => {
  it('bot 玩家 → true；真人 / 无 playerId / AI 家长台词 → false', () => {
    expect(isBotActionEntry(entry(1, BOT), HUMAN)).toBe(true);
    expect(isBotActionEntry(entry(2, 'p-bot-2'), HUMAN)).toBe(true);
    expect(isBotActionEntry(entry(3, HUMAN), HUMAN)).toBe(false);
    expect(isBotActionEntry(entry(4, undefined), HUMAN)).toBe(false);
    expect(isBotActionEntry(entry(5, BOT, { asAi: true }), HUMAN)).toBe(false);
  });
});

/* ============ 排队：按到达顺序、一次一条 ============ */
describe('enqueueToastEntries —— queue', () => {
  it('真人/系统日志各占一条，按到达顺序排', () => {
    const items = enqueueToastEntries(
      [],
      [entry(0, HUMAN), entry(1, undefined), entry(2, HUMAN)],
      HUMAN,
    );
    expect(items).toHaveLength(3);
    expect(texts(items)).toEqual([['log 0'], ['log 1'], ['log 2']]);
    expect(items.every((i) => !i.mergeable)).toBe(true);
  });

  it('队首先播：第一条日志在 items[0]，新到的排队尾', () => {
    let items = enqueueToastEntries([], [entry(0, HUMAN)], HUMAN);
    items = enqueueToastEntries(items, [entry(1, HUMAN), entry(2, HUMAN)], HUMAN);
    expect(items[0].texts).toEqual(['log 0']);
    expect(items).toHaveLength(3);
    /* 播完队首（组件 prev.slice(1)）→ 下一条顶上，顺序不乱 */
    expect(texts(items.slice(1))).toEqual([['log 1'], ['log 2']]);
  });

  it('空输入原样返回（无新日志不动队列）', () => {
    const items = enqueueToastEntries([], [entry(0, HUMAN)], HUMAN);
    expect(enqueueToastEntries(items, [], HUMAN)).toEqual(items);
  });
});

/* ============ 合并：连续 bot 动作进同一条 ============ */
describe('enqueueToastEntries —— merge', () => {
  it('连续 bot 动作合并成一条组合行（texts 全收、rev 递增）', () => {
    const items = enqueueToastEntries(
      [],
      [entry(0, BOT), entry(1, BOT), entry(2, BOT)],
      HUMAN,
    );
    expect(items).toHaveLength(1);
    expect(items[0].mergeable).toBe(true);
    expect(items[0].texts).toEqual(['log 0', 'log 1', 'log 2']);
    expect(items[0].rev).toBe(2);
    expect(items[0].key).toBe(0); /* key 保持首条 id */
  });

  it('真人/系统日志打断连续：bot-真人-bot → 三条（1+1+1）', () => {
    const items = enqueueToastEntries(
      [],
      [entry(0, BOT), entry(1, BOT), entry(2, HUMAN), entry(3, BOT), entry(4, BOT)],
      HUMAN,
    );
    expect(texts(items)).toEqual([
      ['log 0', 'log 1'],
      ['log 2'],
      ['log 3', 'log 4'],
    ]);
  });

  it('AI 家长台词（asAi）不并入 bot 动作条', () => {
    const items = enqueueToastEntries(
      [],
      [entry(0, BOT), entry(1, BOT, { asAi: true }), entry(2, BOT)],
      HUMAN,
    );
    expect(texts(items)).toEqual([['log 0'], ['log 1'], ['log 2']]);
    expect(items[1].mergeable).toBe(false);
  });

  it(`合并有上限：第 ${TOAST_MERGE_MAX + 1} 条 bot 动作开新条排队`, () => {
    const fresh = Array.from({ length: TOAST_MERGE_MAX + 2 }, (_, i) =>
      entry(i, BOT),
    );
    const items = enqueueToastEntries([], fresh, HUMAN);
    expect(items).toHaveLength(2);
    expect(items[0].texts).toHaveLength(TOAST_MERGE_MAX);
    expect(items[1].texts).toEqual([`log ${TOAST_MERGE_MAX}`, `log ${TOAST_MERGE_MAX + 1}`]);
  });

  it('并入队尾条：显示中的真人条不动，后来的 bot 动作在队尾合成一条', () => {
    let items = enqueueToastEntries([], [entry(0, HUMAN)], HUMAN);
    items = enqueueToastEntries(items, [entry(1, BOT), entry(2, BOT)], HUMAN);
    expect(items[0].texts).toEqual(['log 0']);
    expect(items[0].rev).toBe(0);
    expect(items[1].texts).toEqual(['log 1', 'log 2']);
  });

  it('显示中的 bot 条也可并入（rev+1 → 组件重计 4s dwell）', () => {
    let items = enqueueToastEntries([], [entry(0, BOT)], HUMAN);
    items = enqueueToastEntries(items, [entry(1, BOT)], HUMAN);
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe(0);
    expect(items[0].rev).toBe(1);
    expect(items[0].texts).toEqual(['log 0', 'log 1']);
  });
});

/* ============ 源码/CSS 断言：dwell / 排队 / 点按 / 点击区 / 层级 ============ */
describe('toast-4s wiring (source assertions)', () => {
  it('dwell 定稿 4000ms：组件常量与 tokens.css 变量同值', () => {
    expect(toastTsx).toContain('TOAST_VISIBLE_MS = 4000');
    expect(tokensCss).toContain('--toast-visible-ms: 4000ms');
    /* 淡出段不变：自动消失计时 = 4000 - 300 */
    expect(toastTsx).toContain('TOAST_VISIBLE_MS - TOAST_FADE_MS');
  });

  it('排队接线：组件经 enqueueToastEntries 建队、只渲染队首 items[0]', () => {
    expect(toastTsx).toContain('enqueueToastEntries');
    expect(toastTsx).toContain('const current = items[0]');
    /* 渲染分支只有一个 .toast 元素——同屏绝不叠条 */
    expect(toastTsx.match(/className=\{'toast'/g)).toHaveLength(1);
  });

  it('点按即关：toast 是 <button type="button"> + onClick dismiss', () => {
    expect(toastTsx).toContain('type="button"');
    expect(toastTsx).toContain('onClick={dismiss}');
    expect(toastTsx).toContain('setLeavingId(itemId)');
  });

  it('点击区 ≥48px：.toast 显式 min-height: --tap-min-size(=48px)', () => {
    const toastBlock = hudCss.slice(
      hudCss.indexOf('.toast {'),
      hudCss.indexOf('.toast--leaving'),
    );
    expect(toastBlock).toContain('min-height: var(--tap-min-size)');
    expect(tokensCss).toContain('--tap-min-size: 48px');
    /* 条本体吃点击；stack 层仍 pointer-events:none 不挡条外按钮 */
    expect(toastBlock).toContain('pointer-events: auto');
    const stackBlock = hudCss.slice(
      hudCss.indexOf('.toast-stack {'),
      hudCss.indexOf('.toast {'),
    );
    expect(stackBlock).toContain('pointer-events: none');
  });

  it('合并行渲染：texts 逐条本地化后用间隔点连成一行', () => {
    expect(toastTsx).toContain("JOIN_SEP = ' · '");
    expect(toastTsx).toContain('current.texts.map(localizeLogText).join(JOIN_SEP)');
  });

  it('Game 传入 humanId：bot/真人动作分流靠它', () => {
    expect(gameTsx).toContain('humanId={state.humanId}');
    expect(toastTsx).toContain('humanId?: PlayerId');
  });
});
