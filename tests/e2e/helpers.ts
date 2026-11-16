/**
 * e2e 公共驱动（PLAN 4.1.6）。
 * stepOnce：优先点 action-primary，否则点 data-key 编号最大的动作
 * （各面板把「走完这一站/不用了」放在最大号，保证永远推进）；
 * 都没有 → 等 200ms（bot 回合自动推进）。
 *
 * 屏计数：addInitScript 注入 MutationObserver，累加每个 data-testid
 * 被「加入 DOM」的次数 —— 轮询会错过 React 两次渲染之间的短暂屏，
 * 用挂载次数断言（如 screen-basket === 2）才可靠。
 */
import { expect, type Page } from '@playwright/test';

export const BANNED_RE =
  /排名|第一名|分数|成绩单|淘汰|排行榜|\bwin(s|ner|ning)?\b|\bwon\b|\blose(r)?\b|\blost\b|\bscores?\b|\brank(ed|ing|s)?\b|\beliminate[ds]?\b/i;

declare global {
  interface Window {
    __seenTestids?: Record<string, number>;
  }
}

/** 在页面脚本前注入：统计每个 data-testid 挂载进 DOM 的次数 */
function observeTestids(): void {
  const counts: Record<string, number> = {};
  window.__seenTestids = counts;
  const bump = (el: Element) => {
    const id = el.getAttribute('data-testid');
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  };
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        const el = n as Element;
        if (el.hasAttribute('data-testid')) bump(el);
        el.querySelectorAll('[data-testid]').forEach(bump);
      });
    }
  });
  mo.observe(document, { childList: true, subtree: true });
}

/** 打开游戏并收集 pageerror；默认 ?seed=1&fast=1（bot 零延迟，整局秒级） */
export async function openGame(page: Page, extra = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(observeTestids);
  await page.goto(`/?seed=1&fast=1${extra}`);
  return errors;
}

/** 某个 data-testid 累计挂载次数（未出现 → 0） */
export async function mountCount(page: Page, testid: string): Promise<number> {
  return page.evaluate((id) => window.__seenTestids?.[id] ?? 0, testid);
}

const PRIMARY = '[data-testid="action-primary"]:not([disabled])';

/** 找页面上 data-key 最大的「可见」可点元素（兜底推进：走完这一站/不用了）。
 *  只挑有布局盒的元素——display:none 的隐藏按钮（如手机横屏收起的
 *  桌面列）点击会永远等不到 visible。 */
async function lastKeyed(page: Page) {
  const handle = await page.evaluateHandle(() => {
    const els = [
      ...document.querySelectorAll<HTMLElement>('[data-key]:not([disabled])'),
    ].filter((el) => el.getClientRects().length > 0);
    if (els.length === 0) return null;
    return els.reduce((a, b) =>
      Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a,
    );
  });
  return handle.asElement();
}

export type StepKind = 'primary' | 'keyed' | 'wait';

export async function stepOnce(page: Page, tap = false): Promise<StepKind> {
  const primary = page.locator(PRIMARY).first();
  if ((await primary.count()) > 0) {
    if (tap) await primary.tap();
    else await primary.click();
    return 'primary';
  }
  const keyed = await lastKeyed(page);
  if (keyed) {
    if (tap) await keyed.tap();
    else await keyed.click();
    return 'keyed';
  }
  await page.waitForTimeout(200);
  return 'wait';
}

export interface PlayOptions {
  maxSteps?: number;
  tap?: boolean;
  /** 每步前调用：可在此记录途经的屏幕/断言 */
  onStep?: (page: Page, step: number) => Promise<void>;
}

/** 自动玩完一整局，直到「Play again」（action-replay）出现 */
export async function playToEnd(page: Page, opts: PlayOptions = {}): Promise<number> {
  const max = opts.maxSteps ?? 800;
  for (let i = 0; i < max; i++) {
    if ((await page.getByTestId('action-replay').count()) > 0) return i;
    await opts.onStep?.(page, i);
    await stepOnce(page, opts.tap);
  }
  throw new Error(`playToEnd: did not reach "Play again" in ${max} steps`);
}

/** 断言页面没有页面错误、没有禁用词 */
export async function assertClean(page: Page, errors: string[]): Promise<void> {
  expect(errors, 'pageerror').toEqual([]);
  expect(await page.locator('body').innerText()).not.toMatch(BANNED_RE);
}
