// R6 N2 量测：toast 与 语言开关 / 站名签(.popup-head) / 卡名 的两两重叠，
// 三个场景（自动局进行中、市场扇、伙伴邀请）× 采样 250ms 一帧，报最大重叠
// 用法: node shots/probe-r6-n2.mjs <w> <h> <phone|desktop>
import { chromium } from '@playwright/test';

const W = Number(process.argv[2]);
const H = Number(process.argv[3]);
const PHONE = process.argv[4] === 'phone';
const browser = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
await ctx.addInitScript(() => { try { localStorage.setItem('maicai-lang', 'en'); localStorage.setItem('maicai-icons-seen', '1'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
if (PHONE && W === 874) {
  await page.addStyleTag({ content: ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}' }).catch(() => {});
}
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  if ((await page.locator('.popup').count()) === 0) break;
  await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
}
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-bar"]').waitFor({ timeout: 10_000 });
}

const SAMPLER = () => {
  window.__n2 = { frames: 0, toastSeen: 0, maxToggle: 0, maxHead: 0, maxName: 0, worstName: '', toastRects: [] };
  const inter = (a, b) => {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  };
  window.__n2timer = setInterval(() => {
    const S = window.__n2;
    S.frames++;
    const toasts = [...document.querySelectorAll('.toast')].map((t) => t.getBoundingClientRect());
    if (!toasts.length) return;
    S.toastSeen++;
    const tog = document.querySelector('.lang-toggle-wrap')?.getBoundingClientRect();
    const head = document.querySelector('.popup-head')?.getBoundingClientRect();
    const names = [...document.querySelectorAll('.card-view-name')].map((n) => ({
      r: n.getBoundingClientRect(), t: n.textContent.trim(),
    }));
    for (const t of toasts) {
      if (S.toastRects.length < 3) S.toastRects.push({ x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.width), h: Math.round(t.height) });
      if (tog) S.maxToggle = Math.max(S.maxToggle, inter(t, tog));
      if (head) S.maxHead = Math.max(S.maxHead, inter(t, head));
      for (const n of names) {
        const v = inter(t, n.r);
        if (v > S.maxName) { S.maxName = v; S.worstName = n.t; }
      }
    }
  }, 250);
};
const READ = () => { clearInterval(window.__n2timer); return window.__n2; };

/* 场景 1：自动局（toast 主来源） */
await page.evaluate(() => { document.querySelector('[data-testid="demo-autoplay"]')?.click(); });
await page.evaluate(SAMPLER);
await page.waitForTimeout(12000);
const s1 = await page.evaluate(READ);

/* 场景 2：市场扇开着等 toast（bot 行动持续产生） */
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.evaluate(SAMPLER);
await page.waitForTimeout(10000);
const s2 = await page.evaluate(READ);

/* 场景 3：伙伴邀请弹窗 */
await page.locator('[data-testid="demo-station-3"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.waitForTimeout(2500);
await page.evaluate(SAMPLER);
await page.waitForTimeout(8000);
const s3 = await page.evaluate(READ);

console.log(`N2 ${W}x${H} ${PHONE ? 'phone' : 'desktop'}`);
for (const [k, s] of Object.entries({ autoplay: s1, market: s2, partner: s3 })) {
  console.log(`  ${k}: frames=${s.frames} toastFrames=${s.toastSeen} max∩toggle=${Math.round(s.maxToggle)} max∩head=${Math.round(s.maxHead)} max∩name=${Math.round(s.maxName)}(${s.worstName}) toastRects=${JSON.stringify(s.toastRects)}`);
}
await browser.close();
