/**
 * shot-m45_9b.mjs —— M4.5.9b 横屏右栏文字/按钮修复截图（需 preview 已在 :4173 运行，先 npm run build）。
 * 全部 874×402 触屏横屏 + 模拟安全区（左右 62px、上下 20px）：
 *   market_safe      菜市场右栏：菜名不硬断词（无 Carro t/Ginge r）
 *   market_sel_safe  菜市场选中卡：Buy (N coins) 独占第一行整宽，
 *                    Maybe later / Skip 并排第二行；Done 尽量一行
 *   store_safe       小卖部右栏：同上版式
 *   reflect_before   感想页：6 个选项（点之前）
 *   reflect_after    点完一个选项之后：出现明确的下一步（结尾页 Play again）
 * 用法：node scripts/shot-m45_9b.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173';
const OUT = 'docs/screenshots';
const PREFIX = 'm45_9b_';
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

  const got = { market: false, marketSel: false, store: false, reflect: false };
  for (
    let i = 0;
    i < 900 && !(got.market && got.marketSel && got.store && got.reflect);
    i++
  ) {
    if ((await page.getByTestId('panel-market').count()) > 0) {
      if (!got.market) {
        got.market = true;
        await page.waitForTimeout(500);
        await shot(page, 'market_safe');
      }
      if (!got.marketSel) {
        // 选一张买得起的卡 → 「Buy (N coins)」独占第一行整宽
        const cards = page.locator(
          '.phone-rail [data-testid^="action-stall-"]:not([disabled])',
        );
        const n = await cards.count();
        for (let c = 0; c < n; c++) {
          await cards.nth(c).dispatchEvent('click');
          await page.waitForTimeout(300);
          const label = await page
            .getByTestId('action-primary')
            .textContent()
            .catch(() => '');
          if (/Buy \(\d/.test(label ?? '')) break;
        }
        await page.waitForTimeout(300);
        await shot(page, 'market_sel_safe');
        got.marketSel = true;
      }
      await stepOnce(page);
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
    if (!got.reflect && (await page.locator('.reflection-options').count()) > 0) {
      got.reflect = true;
      await page.waitForTimeout(300);
      await shot(page, 'reflect_before');
      // 点一个选项 → 确认有明确下一步（bot 说完进结尾页「Play again」）
      const opt = page
        .locator('.reflection-options [data-testid="action-primary"]:not([disabled])')
        .first();
      if ((await opt.count()) > 0) {
        await opt.click();
        const replay = page.getByTestId('action-replay');
        await replay.waitFor({ timeout: 20_000 }).catch(() => null);
        await page.waitForTimeout(400);
        console.log(
          '  reflect next step:',
          (await replay.count()) > 0 ? 'Play again (ending page)' : 'options/awaiting still',
        );
      }
      await shot(page, 'reflect_after');
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
