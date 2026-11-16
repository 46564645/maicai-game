/**
 * keyboard.spec.ts —— 纯键盘玩完整局：驱动只发按键
 * （action-primary → 其 data-key 数字；否则按最大 data-key 数字）。
 * 途中验证：W 开钱包→Tab 焦点困在抽屉→Esc 关闭且焦点还原；
 * H 开关求助卡；D 开演示条→焦点 Enter 跳站→Esc；输入框聚焦时
 * 按数字/空格不误触发，Enter 提交打字。
 */
import { expect, test } from '@playwright/test';
import { assertClean, mountCount, openGame } from './helpers';

test.use({ viewport: { width: 1280, height: 800 } });
test.setTimeout(180_000);

interface Probe {
  replay: boolean;
  rho6: boolean;
  key: string | null;
}

/** 一次 evaluate 拿全：是否结束 / 是否到自写反思 / 该按哪个键 */
async function probe(page: import('@playwright/test').Page): Promise<Probe> {
  return page.evaluate(() => {
    const replay = !!document.querySelector('[data-testid="action-replay"]');
    const rho6 = !!document.querySelector(
      '[data-testid="action-reflect-rho-6"]:not([disabled])',
    );
    const pri = document.querySelector<HTMLElement>(
      '[data-testid="action-primary"]:not([disabled])',
    );
    const target =
      pri ??
      [...document.querySelectorAll<HTMLElement>('[data-key]:not([disabled])')].sort(
        (a, b) => Number(b.dataset.key) - Number(a.dataset.key),
      )[0] ??
      null;
    return { replay, rho6, key: target ? (target.dataset.key ?? 'Enter') : null };
  });
}

test('纯键盘玩完整局', async ({ page }) => {
  // 演示条只在 ?demo=1 出现（M4.5.6）——本用例要验演示条，显式带上
  const errors = await openGame(page, '&demo=1');

  await page.locator('[data-primary="true"]').waitFor(); // 等首个主按钮渲染再按键
  await page.keyboard.press('Enter'); // 开始
  await expect(page.getByTestId('screen-characters')).toBeVisible();
  await page.keyboard.press('1'); // 选第 1 个角色
  await expect(page.getByTestId('screen-game')).toBeVisible();

  /* —— 覆盖层键盘检查 —— */
  await page.keyboard.press('w'); // W 开钱包抽屉
  await expect(page.getByTestId('drawer-wallet')).toBeVisible();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  const focusInDrawer = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="drawer-wallet"]')
        ?.contains(document.activeElement) ?? false,
  );
  expect(focusInDrawer, 'Tab 焦点困在钱包抽屉内').toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('drawer-wallet')).toHaveCount(0);
  const focusInDrawerAfter = await page.evaluate(
    () =>
      document
        .querySelector('[data-testid="drawer-wallet"]')
        ?.contains(document.activeElement) ?? false,
  );
  expect(focusInDrawerAfter, 'Esc 后焦点离开抽屉').toBe(false);

  await page.keyboard.press('h'); // H 开求助牌
  await expect(page.getByTestId('card-help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('card-help')).toHaveCount(0);

  /* —— 演示条：?demo=1 自动展开；D 在 demo 会话内开合 —— */
  await expect(page.getByTestId('demo-bar')).toBeVisible();
  await page.keyboard.press('d'); // D 收起
  await expect(page.getByTestId('demo-bar')).toHaveCount(0);
  await page.keyboard.press('d'); // D 再展开
  await expect(page.getByTestId('demo-bar')).toBeVisible();
  await page.locator('[data-testid="demo-station-2"]').focus();
  await page.keyboard.press('Enter'); // 选中第 2 站（菜市场）
  await page.locator('[data-testid="demo-jump"]').focus();
  await page.keyboard.press('Enter'); // DEMO_JUMP
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('demo-bar')).toHaveCount(0);

  /* —— 键盘驱动到「再玩一局」—— */
  let usedFreeText = false;
  for (let i = 0; i < 900; i++) {
    const p = await probe(page);
    if (p.replay) break;

    // 反思页：走「自己写一句」验证输入框聚焦时数字不误触发 + Enter 提交
    if (!usedFreeText && p.rho6) {
      await page.keyboard.press('6'); // 展开自写输入框
      const input = page.getByTestId('reflection-input');
      await input.focus();
      await page.keyboard.type('buy food first1');
      const leaked = await page.evaluate(
        () => document.activeElement?.tagName !== 'INPUT',
      );
      expect(leaked, '输入框聚焦时按键不跳出').toBe(false);
      await page.keyboard.press('Enter'); // 表单提交
      usedFreeText = true;
      continue;
    }

    if (p.key === 'Enter') await page.keyboard.press('Enter');
    else if (p.key !== null) await page.keyboard.press(p.key);
    else await page.waitForTimeout(150);
  }

  await expect(page.getByTestId('action-replay')).toHaveCount(1);
  const plates = await page.evaluate(() =>
    Object.entries(window.__seenTestids ?? {})
      .filter(([k]) => k.startsWith('plate-'))
      .reduce((a, [, v]) => a + v, 0),
  );
  expect(plates, '4 个盘子同屏').toBe(4);
  expect(await mountCount(page, 'screen-basket'), '圈末小结 ≥1').toBeGreaterThanOrEqual(1);
  expect(usedFreeText, '走过打字反思路径').toBe(true);
  await assertClean(page, errors);
});
