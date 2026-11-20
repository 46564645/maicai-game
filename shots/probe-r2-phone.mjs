/** probe-r2-phone.mjs — R2-1/R2-2 手机布局实测探针（874×402 + safe 注入）。
 * Usage: node shots/probe-r2-phone.mjs [shotName]
 * 前置：vite preview 在 4173（serve 当前 dist）。
 * 输出：关键元素 rect + 两两重叠量（JSON），并截图到 shots/<shotName>.png。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const SHOT = process.argv[2] ?? 'r10e_r2_phone_probe.png';
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function waitPanel(page, testid, timeoutMs = 60_000) {
  const panel = page.locator(`[data-testid="${testid}"]`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if ((await panel.count()) > 0) return true;
    if ((await page.locator('.popup').count()) === 0) {
      const enter = page.locator('.board-enter, [data-testid="action-primary"]').first();
      if ((await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function jumpTo(page, stationIdx, panelTestid, lap = null) {
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
    await page.keyboard.press('d');
    await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
  }
  if (lap !== null) await page.locator(`[data-testid="demo-lap-${lap}"]`).dispatchEvent('click');
  await page.locator(`[data-testid="demo-station-${stationIdx}"]`).dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  return waitPanel(page, panelTestid);
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript(() => {
  try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
});
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
await page.addStyleTag({ content: SAFE_CSS });
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

await jumpTo(page, 2, 'panel-market', 1);
await page.evaluate(() => {
  const rail = document.querySelector('.phone-rail');
  if (rail) rail.scrollTop = 0;
});
await page.waitForTimeout(900);

const DUMP = () => {
  const R = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const all = (sel) => Array.from(document.querySelectorAll(sel));
  const one = (sel) => document.querySelector(sel);
  const rail = one('.phone-rail');
  const railCS = rail ? getComputedStyle(rail) : null;
  const out = {
    viewport: { w: innerWidth, h: innerHeight },
    safeBox: { left: 62, top: 20, right: 874 - 62, bottom: 402 - 20 },
    rail: R(rail),
    railContent: rail ? {
      left: Math.round(rail.getBoundingClientRect().left + (parseFloat(railCS.borderLeftWidth) || 0) + (parseFloat(railCS.paddingLeft) || 0)),
      right: Math.round(rail.getBoundingClientRect().right - (parseFloat(railCS.paddingRight) || 0)),
      scrollTop: rail.scrollTop, scrollHeight: rail.scrollHeight, clientHeight: rail.clientHeight,
    } : null,
    botsBar: R(one('.phone-bots')),
    lap: R(one('.phone-lap')),
    prog: R(one('.phone-bots .prog')),
    botChips: all('.phone-bot').map(R),
    traits: all('.phone-bot .bot-trait').map(R),
    thinkBubbles: all('.think-bubble--phone').map((el) => ({ ...R(el), text: el.textContent.trim() })),
    langToggle: R(one('.lang-toggle')),
    phoneTurn: R(one('.phone-turn')),
    boardStatus: R(one('.phone-turn .board-status')),
    popupHead: R(one('.phone-rail .popup-head')),
    popupTitle: R(one('.phone-rail .popup-title')),
    popupGoal: R(one('.phone-rail .popup-goal')),
    popupRecipe: R(one('.phone-rail .popup-recipe')),
    stallHand: R(one('.stall-hand')),
    stallCards: all('[data-testid^="action-stall-"]').slice(0, 6).map(R),
    floatLayer: R(one('.phone-market-float')),
    panelFoot: R(one('.phone-rail .panel-foot')),
    dropZones: all('.phone-rail .drop-zone, .phone-rail .panel-foot > .btn').map(R),
    pendingChip: R(one('.pending-chip')),
    speechBubble: R(one('.phone-rail .speech-bubble')),
  };
  const inter = (a, b) => {
    if (!a || !b) return 0;
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
    return Math.round(x * y);
  };
  out.overlaps = {
    thinkVsTurn: out.thinkBubbles.map((t) => inter(t, out.phoneTurn)),
    thinkVsRail: out.thinkBubbles.map((t) => inter(t, out.rail)),
    chipsVsLang: out.botChips.map((c) => inter(c, out.langToggle)),
    barVsRail: inter(out.botsBar, out.rail),
    headVsRailContentLeft: out.popupHead && out.railContent ? Math.max(0, out.railContent.left - out.popupHead.x) : null,
    headVsRailContentRight: out.popupHead && out.railContent ? Math.max(0, out.popupHead.right - out.railContent.right) : null,
  };
  return out;
};

const dump1 = await page.evaluate(DUMP);
console.log(JSON.stringify(dump1, null, 1));
fs.writeFileSync(`/tmp/r2-dump-${SHOT}.json`, JSON.stringify(dump1, null, 1));

async function snap(name) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'));
  console.log('shot', name);
}
await snap(SHOT);

/* —— 推进一站：点「走完这一站」让 bot 们行动，抓 think 气泡与轮次提示共存态 —— */
if (process.env.R2_ADVANCE === '1') {
  const endBtn = page.locator('.phone-rail .panel-foot > .btn').last();
  await endBtn.click().catch(() => {});
  // 等 bot 回合跑完、回到真人回合（下一站 board-enter 或新弹窗出现）
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(700);
    const n = await page.locator('.think-bubble--phone').count();
    const turn = await page.locator('.phone-turn .board-status').innerText().catch(() => '');
    if (n > 0 && /Your turn/.test(turn)) break;
  }
  await page.evaluate(() => {
    const rail = document.querySelector('.phone-rail');
    if (rail) rail.scrollTop = 0;
  });
  await page.waitForTimeout(400);
  const dump2 = await page.evaluate(DUMP);
  console.log('ADVANCED', JSON.stringify(dump2, null, 1));
  fs.writeFileSync(`/tmp/r2-dump2-${SHOT}.json`, JSON.stringify(dump2, null, 1));
  await snap(SHOT.replace('.png', '-advanced.png'));
}
await browser.close();
