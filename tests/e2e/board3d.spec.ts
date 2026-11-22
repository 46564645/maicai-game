/**
 * board3d.spec.ts —— 3D 棋盘冒烟（DEVELOPMENT §9.5 / PLAN 4.2.4）。
 * ?board=3d（默认 auto 同路径）：<canvas> 存在、无 pageerror、无 WebGL/THREE
 * 报错、截图非空白、DOM 按钮照常驱动；?board=2d 自 2026-11-21 起失效
 * （2D 回退棋盘已移除，带此参数仍走 3D）；拦截 WebGL 后显示错误卡 +
 * Try again，绝不出现 2D 棋盘。规则正确性由单测保证，这里不做像素断言。
 */
import { expect, test } from '@playwright/test';
import { assertClean, openGame, stepOnce } from './helpers';

/** 进主界面：开场 → 选角色 → screen-game */
async function enterGame(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await expect(page.locator('[data-testid="screen-game"]')).toBeVisible();
}

test.describe('3D 棋盘', () => {
  test('?board=3d：canvas 渲染、无报错、DOM 操作照常', async ({ page }) => {
    const errors = await openGame(page, '&board=3d');
    const consoleErrs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrs.push(m.text());
    });

    await enterGame(page);
    // 3D 就绪：canvas 出现（SwiftShader 下 GLB 加载较慢，放宽等待）
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="board3d"]')).toBeVisible();

    // DOM 按钮照常驱动（站点卡 ACK + 抽菜谱 + 几站行动）
    for (let i = 0; i < 8; i++) await stepOnce(page);

    const shot = await page.screenshot();
    expect(shot.byteLength).toBeGreaterThan(30_000); // 非空白画布
    expect(
      consoleErrs.filter((t) => /webgl|three\.?|error/i.test(t)),
      'console 无 WebGL/THREE/Error 报错',
    ).toEqual([]);
    await assertClean(page, errors);
  });

  test('?board=2d：参数已失效，仍走 3D（无 2D 回退）', async ({ page }) => {
    const errors = await openGame(page, '&board=2d');
    await enterGame(page);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="board3d"]')).toBeVisible();
    expect(await page.locator('section.board').count()).toBe(0);
    for (let i = 0; i < 4; i++) await stepOnce(page);
    await assertClean(page, errors);
  });

  test('WebGL 不可用时显示错误卡 + Try again，绝不出现 2D 棋盘', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error 测试注入：让 WebGL 上下文创建失败
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (String(type).includes('webgl')) return null;
        return orig.call(this, type as '2d', ...args);
      };
    });
    const errors = await openGame(page, '&board=3d');
    await enterGame(page);
    // 错误卡出现：无 canvas、无 2D 棋盘（section.board），Try again 可见
    await expect(page.locator('.board-error')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.board-retry')).toBeVisible();
    expect(await page.locator('canvas').count()).toBe(0);
    expect(await page.locator('section.board').count()).toBe(0);
    await assertClean(page, errors);
  });
});
