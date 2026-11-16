import { chromium } from '@playwright/test';
const names = ['Tomato','Egg','Green Onion','Greens','Cucumber','Potato','Carrot','Tofu','Mushroom','Pork','Fish','Ginger','Garlic','Sticker','Marshmallow','Popsicle','Toy'];
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(`<html lang="en"><body style="font-family:'Noto Sans SC','PingFang SC',system-ui,sans-serif"></body></html>`);
for (const size of [16, 15, 14, 13, 12]) {
  const res = await page.evaluate(([names, size]) => {
    return names.map((n) => {
      const d = document.createElement('div');
      d.style.cssText = `font-size:${size}px;font-weight:700;display:inline-block;white-space:nowrap`;
      d.textContent = n;
      document.body.appendChild(d);
      const w = d.getBoundingClientRect().width;
      d.remove();
      return { n, w: Math.round(w * 10) / 10 };
    });
  }, [names, size]);
  console.log(`--- ${size}px ---`);
  for (const r of res) console.log(`  ${r.n.padEnd(12)} ${r.w}px ${r.w > 54 ? 'OVERFLOW@54' : r.w > 50 ? 'tight' : 'ok'}`);
}
await browser.close();
