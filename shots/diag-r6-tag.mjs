import { chromium } from '@playwright/test';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: GL });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { window.localStorage.setItem('maicai-lang', 'en'); } catch {} });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/?board=3d&seed=1&fast=1&demo=1', { waitUntil: 'load', timeout: 30_000 });
await page.locator('[data-testid="action-primary"]').click({ timeout: 15_000 });
await page.locator('[data-testid^="action-char-"]').first().click({ timeout: 15_000 });
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached', timeout: 20_000 });
await page.waitForTimeout(2000);
if ((await page.locator('[data-testid="demo-bar"]').count()) === 0) await page.keyboard.press('d');
await page.locator('[data-testid="demo-station-2"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
await page.locator('[data-testid="panel-market"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(1200);
await page.locator('.stall-hand .hand-item .card-view').first().click();
await page.waitForTimeout(800);
const info = await page.evaluate(async () => {
  const tag = document.querySelector('.stall-hand .hand-tag');
  if (!tag) return 'no tag in stall-hand';
  const chain = [];
  let n = tag;
  while (n && n !== document.body) { chain.push(n.className); n = n.parentElement; }
  const rules = [];
  for (const sheet of document.styleSheets) {
    let list;
    try { list = sheet.cssRules; } catch { continue; }
    const walk = (rs, media) => {
      for (const r of rs) {
        if (r.cssRules) { walk(r.cssRules, r.conditionText ?? media); continue; }
        if (r.selectorText && r.selectorText.includes('hand-tag')) {
          rules.push({ sel: r.selectorText, display: r.style?.display ?? '', media: media ?? '', matches: (() => { try { return tag.matches(r.selectorText); } catch { return 'err'; } })() });
        }
      }
    };
    walk(list, '');
  }
  const cssText = await fetch('http://localhost:4173/assets/index-CmzZh_h0.css').then((r) => r.text()).catch((e) => 'FETCH FAIL ' + e);
  const idxStall = cssText.indexOf('.stall-hand .hand-tag');
  const idxSel = cssText.indexOf('.hand-item--sel .hand-tag');
  return {
    display: getComputedStyle(tag).display,
    text: tag.textContent,
    chain: chain.join(' < '),
    rules,
    matchesStall: tag.matches('.stall-hand .hand-tag'),
    matchesSel: tag.matches('.hand-item--sel .hand-tag'),
    idxStall, idxSel,
    stallRuleText: idxStall >= 0 ? cssText.slice(idxStall, idxStall + 90) : 'ABSENT',
    inlineSheets: [...document.querySelectorAll('style')].map((s) => (s.textContent ?? '').length),
    inlineText: [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n---\n').slice(0, 2400),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
