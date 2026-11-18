/**
 * r7-live-test.mjs — R7 AI 家长站真对话实测驱动。
 * Usage: node shots/r7-live-test.mjs <en|zh>
 * Expects a server (vite preview) on BASE (default http://localhost:4173)
 * serving a build. If the build has VITE_DEEPSEEK_API_KEY baked in, the
 * parent station runs LIVE against DeepSeek; without a key it runs the
 * offline scripted flow — the same script drives both, and the printed
 * transcript shows which mode actually ran.
 *
 * Flow: open game (seed=1, fast bots, demo bar) → pick character →
 * DEMO_JUMP to station 6 (parent) → "Use it now" → answer 4 questions
 * with free text (shopping content, engine keywords included so the
 * completion replay can clear all four) → wait for the goodbye →
 * station closes → dump the chat transcript + screenshots via CDP
 * (page.screenshot hangs on SwiftShader; see measure-ui-cdp.mjs).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const LANG = process.argv[2] ?? 'en';
const GL_ARGS = [
  '--no-sandbox',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

const ANSWERS = {
  en: [
    'I want 2 coins',
    'I want to buy tomatoes and eggs',
    'I bought a sticker and some food',
    'Next time I will buy food first',
  ],
  zh: ['我想要2个币', '我想买番茄和鸡蛋', '我买了贴纸和菜', '下次我先买菜，再看贴纸'],
}[LANG];

async function shot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  const res = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: false });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'));
  console.log(`  shot ${name}`);
}

async function chatText(page) {
  return page.evaluate(() => {
    const chat = document.querySelector('[data-testid="parent-chat"]');
    if (!chat) return '';
    return [...chat.querySelectorAll('.chat-bubble, .chat-system')]
      .map((el) => `${el.className.includes('--me') ? 'CHILD' : 'AI'}: ${el.textContent}`)
      .join('\n');
  });
}

async function aiBubbleCount(page) {
  return page.evaluate(
    () => document.querySelectorAll('[data-testid="parent-chat"] .chat-bubble--ai').length,
  );
}

const browser = await chromium.launch({ args: GL_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
await page.addInitScript((lang) => {
  try {
    window.localStorage.setItem('maicai-lang', lang);
  } catch {
    /* ignore */
  }
}, LANG);
await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);

// intro → character select → board
await page.locator('[data-testid="action-primary"]').click();
await page.locator('[data-testid^="action-char-"]').first().click();
await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
await page.waitForTimeout(3000);

// demo-jump to station 6 (parent). The demo bar auto-opens with
// ?demo=1; pressing 'd' would toggle it shut, so only press if absent.
if ((await page.locator('[data-testid="demo-station-6"]').count()) === 0) {
  await page.keyboard.press('d');
  await page.locator('[data-testid="demo-station-6"]').waitFor({ timeout: 10_000 });
}
await page.locator('[data-testid="demo-station-6"]').dispatchEvent('click');
await page.locator('[data-testid="demo-jump"]').dispatchEvent('click');
await page.keyboard.press('d');
{
  const panel = page.locator('[data-testid="panel-parent"]');
  const t0 = Date.now();
  while (Date.now() - t0 < 60_000) {
    if ((await panel.count()) > 0) break;
    const enter = page.locator('[data-testid="action-primary"]').first();
    const hasPopup = (await page.locator('.popup').count()) > 0;
    if (!hasPopup && (await enter.count()) > 0) await enter.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(300);
  }
  if ((await panel.count()) === 0) throw new Error('parent panel never opened');
}
console.log('parent panel open');

// The demo jump may auto-begin the dialog; click "Use it now" only if
// the chat is not open yet.
if ((await page.locator('[data-testid="parent-chat"]').count()) === 0) {
  await page.locator('[data-testid="panel-parent"] [data-testid="action-primary"]').click();
}
await page.locator('[data-testid="parent-chat"]').waitFor({ timeout: 20_000 });
await page.waitForTimeout(800);
await shot(page, `r7_parent_${LANG}_1_open.png`);
console.log('--- transcript after open ---\n' + (await chatText(page)));

// Adaptive loop: type the next scripted answer when the input is up;
// when the offline settle screen appears ("That's all / Keep
// answering"), choose "Keep answering"; stop when the panel closes.
let given = 0;
for (let round = 0; round < 8; round++) {
  if ((await page.locator('[data-testid="panel-parent"]').count()) === 0) break;
  const input = page.locator('[data-testid="parent-text-input"]');
  if ((await input.count()) > 0 && given < ANSWERS.length) {
    const before = await aiBubbleCount(page);
    await input.fill(ANSWERS[given]);
    await page.locator('[data-testid="action-parent-text"]').click();
    given++;
    const t0 = Date.now();
    let advanced = false;
    while (Date.now() - t0 < 45_000) {
      if ((await page.locator('[data-testid="panel-parent"]').count()) === 0) {
        advanced = true;
        break;
      }
      if ((await aiBubbleCount(page)) > before) {
        advanced = true;
        break;
      }
      // settle screen has no text input: treat as advanced
      if ((await page.locator('[data-testid="parent-text-input"]').count()) === 0) {
        advanced = true;
        break;
      }
      await page.waitForTimeout(500);
    }
    console.log(`answer ${given} advanced=${advanced}`);
    await page.waitForTimeout(600);
    if (given === 2) await shot(page, `r7_parent_${LANG}_2_mid.png`);
  } else if ((await page.locator('[data-testid="action-2"]').count()) > 0) {
    console.log('settle screen → Keep answering');
    await page.locator('[data-testid="action-2"]').click();
    await page.waitForTimeout(800);
  } else {
    await page.waitForTimeout(800);
  }
}
await shot(page, `r7_parent_${LANG}_3_goodbye.png`);
console.log(`--- final transcript (${LANG}) ---\n` + (await chatText(page)));

// live mode: completion replays after ~1.8s; offline: last answer closes directly
await page
  .locator('[data-testid="panel-parent"]')
  .waitFor({ state: 'detached', timeout: 30_000 })
  .catch(() => console.log('  note: parent panel still open after 30s'));
await page.waitForTimeout(1000);
await shot(page, `r7_parent_${LANG}_4_after.png`);
const coins = await page.evaluate(() => document.body.innerText.match(/My coins:?\s*\d+|我的钱[:：]?\s*\d+/)?.[0] ?? 'n/a');
console.log('coins label after station:', coins);
await ctx.close();
await browser.close();
console.log('done');
