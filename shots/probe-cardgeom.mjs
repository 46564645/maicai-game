/** probe-cardgeom.mjs — 对比画廊与游戏内（市场）同一张卡的解剖高度。
 * Usage: node shots/probe-cardgeom.mjs
 */
import { chromium } from '@playwright/test';

const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL_ARGS });

const GEOM = (root) => {
  const card = root;
  const q = (s) => card.querySelector(s);
  const h = (el) => (el ? Math.round(el.offsetHeight * 10) / 10 : null);
  const name = q('.card-view-name');
  const meta = q('.card-view-meta');
  return {
    cardH: h(card), cardW: card ? card.offsetWidth : null,
    artH: h(q('.card-view-art')),
    textTop: q('.card-view-text') ? q('.card-view-text').offsetTop : null,
    nameH: h(name), nameFs: name ? getComputedStyle(name).fontSize : null, nameLh: name ? getComputedStyle(name).lineHeight : null,
    metaH: h(meta),
    gemH: h(q('.card-view-gem')),
    tagH: h(q('.card-view-tag')),
    htmlFs: getComputedStyle(document.documentElement).fontSize,
    bodyFs: getComputedStyle(document.body).fontSize,
  };
};

// 画廊（dev server 4174）
{
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://localhost:4174/gallery.html');
  await page.waitForTimeout(2500);
  for (const id of ['ing-cucumber', 'rec-braised-fish', 'tmp-sticker', 'evt-help-vendor', 'wth-sunny']) {
    const g = await page.evaluate(({ fn, cid }) => {
      const el = document.querySelector(`[data-card-cell="${cid}"] .card-view`);
      const base = (new Function('root', `return (${fn})(root)`))(el);
      const kids = [...el.querySelectorAll('.card-view-text > *, .card-view-meta > *')].map((k) => `${k.className.split(' ')[0]}:${k.offsetHeight}`);
      return { ...base, kids };
    }, { fn: GEOM.toString(), cid: id });
    console.log('gallery', id + ':', JSON.stringify(g));
  }
  await page.close();
}

// 游戏内市场（preview 4173, 1280×800）
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
  await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1');
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 6; i++) {
    if ((await page.locator('.popup').count()) === 0) break;
    await page.locator('.popup [data-testid="action-primary"]').first().click().catch(() => {});
    await page.waitForTimeout(500);
  }
  if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
  await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
  await page.keyboard.press('d');
  await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  const g = await page.evaluate((fn) => {
    const cards = [...document.querySelectorAll('.stall-slot .card-view, .stall-hand .card-view')];
    const named = cards.map((c) => ({ name: c.querySelector('.card-view-name')?.textContent?.trim(), el: c }));
    const target = named.find((n) => n.name === 'Cucumber') || named[0];
    return { picked: target?.name, geom: target ? (new Function('root', `return (${fn})(root)`))(target.el) : null };
  }, GEOM.toString());
  console.log('ingame market card:', JSON.stringify(g));
  await page.close();
}
await browser.close();
