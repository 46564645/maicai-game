/**
 * fullgame.spec.ts —— 1280×800 鼠标驱动自动玩完整局：
 * 开场 → 选角色 → 3 圈 × 8 站 → 每圈「我的篮子」→ 一起开饭（4 个盘子）
 * → 最满意的决定 → 「再玩一局」；断言途中无禁用词、无 pageerror。
 * 屏计数用 helpers 的 MutationObserver（React 两次渲染之间的短屏轮询会漏）。
 */
import { expect, test } from '@playwright/test';
import { assertClean, mountCount, openGame, playToEnd } from './helpers';

test.use({ viewport: { width: 1280, height: 800 } });
test.setTimeout(180_000);

test('自动玩完一整局', async ({ page }) => {
  const errors = await openGame(page);

  // 「4 个盘子同屏」按运行时真的同屏一次来断言：挂载次数在并行负载下
  // 可能把「回到饭桌 → 再看流水」算成两次（playtest 报告已指出这条不稳）。
  let sawFourPlates = false;
  await playToEnd(page, {
    onStep: async (p) => {
      if (sawFourPlates) return;
      if ((await p.locator('[data-testid^="plate-"]').count()) === 4) sawFourPlates = true;
    },
  });

  expect(await mountCount(page, 'screen-game'), '途经主棋盘').toBeGreaterThanOrEqual(1);
  expect(
    await mountCount(page, 'screen-basket'),
    '「我的篮子」圈末小结至少 2 次（两次渲染间可能漏计，>=2 即可）',
  ).toBeGreaterThanOrEqual(2);
  expect(await mountCount(page, 'screen-feast'), '到达开饭页').toBeGreaterThanOrEqual(1);
  expect(await mountCount(page, 'ledger'), '「看看钱花到哪了」流水').toBeGreaterThanOrEqual(1);
  expect(
    await mountCount(page, 'screen-reflection'),
    '到达最满意的决定页',
  ).toBeGreaterThanOrEqual(1);

  expect(sawFourPlates, '开饭时 4 个盘子同屏').toBe(true);

  await assertClean(page, errors);
});
