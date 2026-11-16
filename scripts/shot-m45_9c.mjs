/**
 * shot-m45_9c.mjs —— M4.5.9c 感想页选完后版式截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 874×402 触屏横屏 + 模拟安全区（左右 62px、上下 20px）：
 *   reflect_after_safe  感想结果页：4 人感想 2×2 卡片（头像+名字+一句话，
 *                       自己左上），下面一行小字「Everyone has shared」，
 *                       再往下「Play again」≥48px，一屏全显示不重叠
 * 用法：node scripts/shot-m45_9c.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = 'm45_9c_';
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

  let done = false;
  for (let i = 0; i < 900 && !done; i++) {
    if ((await page.locator('.reflection-options').count()) > 0) {
      // 点一个选项 → bot 依次说完 → 感想结果页
      const opt = page
        .locator('.reflection-options [data-testid="action-primary"]:not([disabled])')
        .first();
      if ((await opt.count()) > 0) await opt.click();
      await page.getByTestId('action-replay').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(400);
      await shot(page, 'reflect_after_safe');
      done = true;
      continue;
    }
    await stepOnce(page);
  }
  console.log('  done:', done);
  if (errors.length) console.log('  pageerror:', errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
}
console.log('done');
