// debug: reproduce safearea store-scroll state at 874x402
import { chromium } from 'playwright';

const b = await chromium.launch({
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await b.newPage({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.log('pageerror', e));
await page.goto('http://localhost:4188/?demo=1&lang=en');
await page.getByTestId('action-primary').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="demo-bar"]').waitFor();
await page.addStyleTag({ content: ':root{--safe-t:20px!important;--safe-r:62px!important;--safe-b:20px!important;--safe-l:62px!important;}' });
await page.locator('[data-testid="demo-station-7"]').click();
await page.locator('[data-testid="demo-jump"]').click();
await page.waitForTimeout(500);
// instrument rail scroll timeline
await page.evaluate(() => {
  const rail = document.querySelector('.phone-rail');
  window.__log = [];
  if (rail) {
    rail.addEventListener('scroll', () =>
      window.__log.push(`t${performance.now().toFixed(0)} scroll top=${rail.scrollTop} h=${rail.scrollHeight} ch=${rail.clientHeight}`));
    new MutationObserver(() => window.__log.push(`t${performance.now().toFixed(0)} mut h=${rail.scrollHeight}`))
      .observe(rail, { childList: true, subtree: true });
  }
});
// hide demo bar to reach rail
await page.locator('[data-testid="demo-close"]').dispatchEvent('click');
// click "Go to this stop" until store panel appears (intro -> act)
for (let i = 0; i < 30; i++) {
  if ((await page.getByTestId('panel-store').count()) > 0) break;
  const go = page.locator('.phone-turn [data-testid="action-primary"], .phone-rail [data-testid="action-primary"]:not([disabled])').first();
  if ((await go.count()) > 0) { try { await go.click({ timeout: 800 }); } catch {} }
  else {
    const k = await page.evaluate(() => {
      const els = [...document.querySelectorAll('[data-key]:not([disabled])')].filter(e => e.getClientRects().length);
      const m = els.sort((a, b) => Number(b.dataset.key) - Number(a.dataset.key))[0];
      if (m) { m.click(); return m.getAttribute('aria-label') || m.textContent; }
      return null;
    });
    if (!k) await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
}
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const rail = document.querySelector('.phone-rail');
  const btns = [...document.querySelectorAll('.phone-rail [data-key]:not([disabled])')]
    .filter((e) => e.getClientRects().length > 0)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { key: e.dataset.key, label: (e.getAttribute('aria-label') || e.textContent || '').slice(0, 34), t: +r.top.toFixed(0), b: +r.bottom.toFixed(0) };
    });
  return {
    hasPanel: !!document.querySelector('[data-testid="panel-store"]'),
    scrollTop: rail?.scrollTop, scrollHeight: rail?.scrollHeight, clientHeight: rail?.clientHeight,
    offBottom: rail ? rail.scrollHeight - rail.scrollTop - rail.clientHeight : null,
    btns,
  };
});
console.log(JSON.stringify(info, null, 1));
await page.waitForTimeout(2000);
console.log('after2s', JSON.stringify(await page.evaluate(() => {
  const rail = document.querySelector('.phone-rail');
  return { scrollTop: rail?.scrollTop, scrollHeight: rail?.scrollHeight, offBottom: rail ? rail.scrollHeight - rail.scrollTop - rail.clientHeight : null };
})));
console.log((await page.evaluate(() => window.__log || [])).slice(-40).join('\n'));
await b.close();
