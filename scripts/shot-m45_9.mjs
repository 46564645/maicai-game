/**
 * shot-m45_9.mjs —— M4.5.9 安全区补修截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 全部 874×402 触屏横屏 + 模拟安全区（左右 62px、上下 20px）：
 *   market_safe  菜市场右栏：6 卡 + 底部「Done with this stop」整颗露出
 *   store_safe   小卖部右栏：同上（选中一张卡 → 「Buy (N coins)」）
 *   feast        开饭页：标题「Dinner time」、4 个盘子一行、按钮可见
 *   reflect      感想页：6 个选项 2×3 一屏全显示
 * 用法：node scripts/shot-m45_9.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = 'm45_9_';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
const SAFE_CSS =
  ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${PREFIX}${name}.png` });
  console.log(`  ${PREFIX}${name}.png`);
}

/** 自动推进一步：优先主按钮，否则 data-key 最大者，都没有就等 bot */
async function stepOnce(page) {
  const primary = page.locator('[data-testid="action-primary"]:not([disabled])').first();
  if ((await primary.count()) > 0) {
    await primary.click();
    return;
  }
  const handle = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('[data-key]:not([disabled])')].filter(
      (el) => el.getClientRects().length > 0,
    );
    if (!els.length) return null;
    return els.reduce((a, b) =>
      Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a,
    );
  });
  const el = handle.asElement();
  if (el) {
    await el.click();
    return;
  }
  await page.waitForTimeout(200);
}

const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
try {
  const ctx = await browser.newContext({
    viewport: { width: 874, height: 402 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.locator('[data-primary="true"]').waitFor();
  await page.locator('[data-testid="action-primary"]').click(); // 开场 → 选人
  await page.keyboard.press('d'); // 收起演示条
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 15_000 }).catch(() => null);
  await page.waitForTimeout(3000);

  // 注入模拟安全区
  await page.addStyleTag({ content: SAFE_CSS });
  await page.waitForTimeout(300);

  const got = { market: false, store: false, feast: false, reflect: false };
  for (let i = 0; i < 900 && !(got.market && got.store && got.feast && got.reflect); i++) {
    if (!got.market && (await page.getByTestId('panel-market').count()) > 0) {
      got.market = true;
      await page.waitForTimeout(500);
      // 选中一张卡 → 「Buy (N coins)」也一并入镜
      const card = page
        .locator('.phone-rail [data-testid^="action-stall-"]:not([disabled])')
        .first();
      if ((await card.count()) > 0) {
        await card.dispatchEvent('click');
        await page.waitForTimeout(400);
      }
      await shot(page, 'market_safe');
      continue;
    }
    if (!got.store && (await page.getByTestId('panel-store').count()) > 0) {
      got.store = true;
      await page.waitForTimeout(500);
      const card = page
        .locator('.phone-rail [data-testid^="action-store-"]:not([disabled])')
        .first();
      if ((await card.count()) > 0) {
        await card.dispatchEvent('click');
        await page.waitForTimeout(400);
      }
      await shot(page, 'store_safe');
      continue;
    }
    if (!got.feast && (await page.locator('[data-testid^="plate-"]').count()) === 4) {
      got.feast = true;
      await page.waitForTimeout(400);
      await shot(page, 'feast');
      continue;
    }
    if (!got.reflect && (await page.locator('.reflection-options').count()) > 0) {
      got.reflect = true;
      await page.waitForTimeout(300);
      await shot(page, 'reflect');
      continue;
    }
    await stepOnce(page);
  }
  console.log('  got:', JSON.stringify(got));
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
}
console.log('done');
