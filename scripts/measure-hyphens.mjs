import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(`<html lang="en"><body style="font-family:'Noto Sans SC','PingFang SC',system-ui,sans-serif"></body></html>`);
const cases = [
  { label: 'shy+manual', css: 'hyphens:manual;word-break:keep-all', html: 'Mush\u00ADroom' },
  { label: 'shy+none', css: 'hyphens:none;word-break:keep-all', html: 'Mush\u00ADroom' },
  { label: 'shy+auto', css: 'hyphens:auto;word-break:keep-all', html: 'Mush\u00ADroom' },
  { label: 'wbr+keepall', css: 'hyphens:none;word-break:keep-all', html: 'Mush-<wbr>room' },
  { label: 'wbr+keepall-nohyph', css: 'hyphens:none;word-break:keep-all', html: 'Mush<wbr>room' },
  { label: 'realhyphen', css: 'hyphens:none;word-break:keep-all', html: 'Mush-room' },
];
const res = await page.evaluate((cases) => {
  return cases.map((c) => {
    const d = document.createElement('div');
    d.style.cssText = `font-size:14px;font-weight:700;width:54px;${c.css};position:absolute;left:-9999px;line-height:1.3`;
    d.innerHTML = c.html;
    document.body.appendChild(d);
    const h = d.getBoundingClientRect().height;
    const lines = Math.round(h / (14 * 1.3));
    // first line text
    let first = '';
    const range = document.createRange();
    const txt = d.textContent;
    for (let i = txt.length; i > 0; i--) {
      range.setStart(d.firstChild, 0);
      let node = d.firstChild, off = i;
      while (node && off > (node.textContent?.length ?? 0)) { off -= node.textContent.length; node = node.nextSibling; }
      if (!node) break;
      range.setEnd(node, off);
      if (range.getBoundingClientRect().height <= 14 * 1.5) { first = txt.slice(0, i); break; }
    }
    d.remove();
    return { label: c.label, lines, first };
  });
}, cases);
for (const r of res) console.log(r);
await browser.close();
