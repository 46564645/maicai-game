/**
 * mobile.spec.ts —— M4.5.6：手机只支持横屏（iPhone 17 Pro：横 874×402 / 竖 402×874）。
 * 竖屏 → 全屏「把手机横过来」提示；转横自动进入（不点任何东西）。
 * 横屏 = 左岛右栏布局：竖屏玩完整局 + 周期断言无横向滚动。
 */
import { expect, test } from '@playwright/test';
import { assertClean, mountCount, openGame, playToEnd } from './helpers';

test.use({ hasTouch: true, isMobile: true });
test.setTimeout(240_000);

test('竖屏 402×874：提示「把手机横过来」，转横后自动进入', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  const errors = await openGame(page);

  const gate = page.getByTestId('rotate-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('Turn your phone sideways');

  // 转成横屏 → 提示层自动消失，回到游戏，不用点任何东西
  await page.setViewportSize({ width: 874, height: 402 });
  await expect(gate).toHaveCount(0);
  await expect(page.locator('#root')).toContainText("Let's Go Shopping");

  // 再转回竖屏 → 提示又盖住（方向是实时监听，不是一次性）
  await page.setViewportSize({ width: 402, height: 874 });
  await expect(gate).toBeVisible();

  await assertClean(page, errors);
});

test('横屏 874×402：左岛右栏布局，触屏玩完整局', async ({ page }) => {
  await page.setViewportSize({ width: 874, height: 402 });
  const errors = await openGame(page);

  let sawRail = false;
  let sawFourPlates = false;
  let rotatedMidGame = false;
  await playToEnd(page, {
    tap: true,
    maxSteps: 900,
    onStep: async (p, i) => {
      if (!sawRail && (await p.locator('.phone-rail').count()) > 0) {
        sawRail = true;
        // 横屏三件套：左上小头像排（含第几圈）/ 右竖栏 / 左下圆钮
        await expect(p.locator('.phone-bots')).toBeVisible();
        await expect(p.locator('.phone-lap')).toContainText('Lap');
        await expect(p.locator('.phone-quick')).toBeVisible();
        // 桌面底栏整个不渲染
        await expect(p.locator('.game-bottom')).toHaveCount(0);
        // 钱是核心：钱包圆钮上永远显示币数（.phone-quick 里的那个）
        await expect(
          p.locator('.phone-quick [data-testid="btn-wallet"]'),
        ).toContainText(/🪙\s*\d+/);
        // 竖屏提示不存在
        await expect(p.getByTestId('rotate-gate')).toHaveCount(0);
      }
      // 市场/杂货店弹窗收进右竖栏（.popup 在 .phone-rail 里）
      if (
        (await p.locator(
          '[data-testid="panel-market"], [data-testid="panel-store"] .popup',
        ).count()) > 0 ||
        (await p.locator('.phone-rail [data-testid^="panel-"]').count()) > 0
      ) {
        await expect(p.locator('.phone-rail .popup')).toBeVisible();
      }
      // 游戏中途转一次竖屏 → 提示盖住；转回来继续玩
      if (!rotatedMidGame && sawRail && i > 10) {
        rotatedMidGame = true;
        await p.setViewportSize({ width: 402, height: 874 });
        await expect(p.getByTestId('rotate-gate')).toBeVisible();
        await p.setViewportSize({ width: 874, height: 402 });
        await expect(p.getByTestId('rotate-gate')).toHaveCount(0);
      }
      if (!sawFourPlates && (await p.locator('[data-testid^="plate-"]').count()) === 4) {
        sawFourPlates = true;
      }
      if (i % 10 === 0) {
        const w = await p.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
        expect(w, '无横向滚动').toBeLessThanOrEqual(874);
      }
    },
  });

  expect(sawRail, '出现过右竖栏横屏布局').toBe(true);
  const w = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0);
  expect(w).toBeLessThanOrEqual(874);
  expect(await mountCount(page, 'screen-feast')).toBeGreaterThanOrEqual(1);
  expect(sawFourPlates, '4 个盘子同屏').toBe(true);
  await assertClean(page, errors);
});
