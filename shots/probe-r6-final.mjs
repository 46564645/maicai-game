// R6 收官证据探针（每个尺寸一跑）：
//  A 市场：价丸检查（每面恰 1 丸 / 丸在卡内 / 丸∩✓=0 / 数字 ≥18px）、
//     美术占比（美术区高/卡高）、记号 vs 卡底色对比（逐卡）、
//     首访记号说明条是否出现（全新上下文应出现）
//  B 状态图（Part 1.5）：找含灰底卡（tmp-*）的种子——选中灰卡 +
//     按住一张普通卡 + 其余静置，截图 r6_states_<W>.png
//  C 伙伴站：截图 r6_swap_<W>.png；有邀约卡时量其美术占比与面文字行数
// 用法: node shots/probe-r6-final.mjs <667|874|1024|1280|1440>
import { chromium } from '@playwright/test';

const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const BASE = 'http://localhost:4173';
const SIZES = { 667: [667, 375], 874: [874, 402], 1024: [1024, 768], 1280: [1280, 800], 1440: [1440, 900] };
const key = process.argv[2] ?? '1280';
const [W, H] = SIZES[key];
const phone = key === '874' || key === '667';

const browser = await chromium.launch({ args: GL });

async function freshPage(seed) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    hasTouch: phone,
    isMobile: phone,
  });
  await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?board=3d&seed=${seed}&fast=1&demo=1`, { waitUntil: 'load', timeout: 30_000 });
  if (phone && key === '874') {
    await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
  }
  await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
  await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(2000);
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(600);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  return { ctx, page };
}

async function jump(page, n) {
  await page.locator(`[data-testid="demo-station-${n}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d'); /* 关演示条，截图不带它 */
  await page.waitForTimeout(400);
}

/* ---------- A: market measurements (seed 1) ---------- */
{
  const { ctx, page } = await freshPage(1);
  await jump(page, 2);
  await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
  /* 首访说明条：轮询等它在队列里露头（全新上下文，标记未落） */
  let toastSeen = false;
  for (let i = 0; i < 24 && !toastSeen; i++) {
    toastSeen = await page.evaluate(() =>
      [...document.querySelectorAll('.toast-text')].some((t) => t.textContent.includes('Card marks')),
    );
    if (!toastSeen) await page.waitForTimeout(700);
  }
  console.log(`FINAL ${key} firstVisitToast=${toastSeen}`);
  const rows = await page.evaluate(() => {
    const lum = (r, g, b) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (fg, bg) => {
      const [l1, l2] = [lum(...fg), lum(...bg)].sort((a, b) => b - a);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const inter = (a, b) => {
      const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      return x * y;
    };
    const ICON_FG = { list: [20, 113, 58], food: [207, 74, 14], fun: [123, 79, 208] };
    const out = [];
    for (const view of document.querySelectorAll('.stall-hand .card-view')) {
      const cardR = view.getBoundingClientRect();
      const gems = view.querySelectorAll('.card-view-gem');
      const gem = gems[0];
      const gemR = gem?.getBoundingClientRect();
      const mark = view.querySelector('.card-view-mark');
      const markR = mark?.getBoundingClientRect();
      const art = view.querySelector('.card-view-art');
      const artR = art?.getBoundingClientRect();
      const iconEl = view.querySelector('.meta-icon');
      const kind = iconEl ? [...iconEl.classList].join(' ').match(/meta-icon--(\w+)/)?.[1] : null;
      const bg = parse(getComputedStyle(view).backgroundColor);
      out.push({
        name: view.querySelector('.card-view-name')?.textContent?.trim(),
        gems: gems.length,
        gemFontPx: gem ? parseFloat(getComputedStyle(gem).fontSize) : null,
        gemInsideCard: gemR ? gemR.left >= cardR.left - 1 && gemR.right <= cardR.right + 1 && gemR.top >= cardR.top - 1 && gemR.bottom <= cardR.bottom + 1 : null,
        gemMarkOverlap: gemR && markR ? Math.round(inter(gemR, markR)) : 0,
        artShare: artR ? +(artR.height / cardR.height).toFixed(3) : null,
        iconKind: kind,
        iconPx: iconEl ? Math.round(iconEl.getBoundingClientRect().width) : null,
        iconContrast: kind ? +ratio(ICON_FG[kind], bg).toFixed(2) : null,
        cardBg: `rgb(${bg.join(',')})`,
      });
    }
    return out;
  });
  for (const r of rows) console.log('  ', JSON.stringify(r));
  await ctx.close();
}

/* ---------- B: state shot with a grey-bg card (seeds 2..6) ---------- */
{
  let done = false;
  for (let seed = 2; seed <= 6 && !done; seed++) {
    const { ctx, page } = await freshPage(seed);
    await jump(page, 2);
    await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(900);
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('.stall-hand [data-testid^="action-stall-"]')].map((el) => el.dataset.testid.replace('action-stall-', '')),
    );
    const tmpIdx = ids.findIndex((id) => id.startsWith('tmp-'));
    if (tmpIdx < 0) { await ctx.close(); continue; }
    const views = page.locator('.stall-hand .hand-item .card-view');
    await views.nth(tmpIdx).click().catch(() => {}); /* 灰卡 = 选中态 */
    await page.waitForTimeout(500);
    const otherIdx = ids.findIndex((id, i) => i !== tmpIdx && !id.startsWith('tmp-'));
    const box = await views.nth(otherIdx).boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down(); /* 普通卡 = 按压态（TiltCard 倾斜响应） */
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: `shots/r6_states_${W}.png`, timeout: 90_000 });
    console.log(`FINAL ${key} statesShot seed=${seed} greyCard=${ids[tmpIdx]} pressedIdx=${otherIdx}`);
    await page.mouse.up().catch(() => {});
    await ctx.close();
    done = true;
  }
  if (!done) console.log(`FINAL ${key} statesShot NONE (no tmp card in seeds 2..6)`);
}

/* ---------- C: partner / swap shot (seeds 1..4) ---------- */
{
  let done = false;
  for (let seed = 1; seed <= 4 && !done; seed++) {
    const { ctx, page } = await freshPage(seed);
    await jump(page, 3);
    await page.locator('[data-testid="panel-partner"]').waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const invite = document.querySelector('.invite-card .card-view') ?? [...document.querySelectorAll('.card-view')].find((v) => v.querySelector('.card-view-tag'));
      if (!invite) return null;
      const cardR = invite.getBoundingClientRect();
      const artR = invite.querySelector('.card-view-art')?.getBoundingClientRect();
      const tag = invite.querySelector('.card-view-tag');
      return {
        name: invite.querySelector('.card-view-name')?.textContent?.trim(),
        tag: tag?.textContent?.trim(),
        artShare: artR ? +(artR.height / cardR.height).toFixed(3) : null,
      };
    });
    await page.screenshot({ path: `shots/r6_swap_${W}.png`, timeout: 90_000 });
    console.log(`FINAL ${key} partnerShot seed=${seed} invite=${JSON.stringify(info)}`);
    await ctx.close();
    done = true;
  }
}
await browser.close();
