import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(`<div id="a" style="width:104px;height:152px;font-size:15px;zoom:0.85"><span id="b" style="font-size:15px">x</span></div><div id="c" style="width:104px;height:152px;font-size:15px"></div>`);
const r = await page.evaluate(() => {
  const a = document.getElementById('a');
  const b = document.getElementById('b');
  const c = document.getElementById('c');
  const ra = a.getBoundingClientRect();
  return {
    zoomedRectW: ra.width,
    aFont: getComputedStyle(a).fontSize,
    bFont: getComputedStyle(b).fontSize,
    aClientW: a.clientWidth,
    aScrollW: a.scrollWidth,
    cFont: getComputedStyle(c).fontSize,
  };
});
console.log(JSON.stringify(r));
await browser.close();
