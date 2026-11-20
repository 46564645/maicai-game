/** probe-sweep.mjs — Thong/ww 文字冲突全屏排查（截图包 v3 口径）：
 * 双视口逐屏量测三类数据，dump 到 shots/sweep-data/<视口>-<屏>.json：
 *  ① 文字溢出：所有可见元素 scrollWidth−clientWidth / scrollHeight−clientHeight
 *     （排除 overflow auto/scroll 的滚动容器本体）
 *  ② 卡面文字压图：每张 .card-view 的文字元素（名/标签/宝石/类别/✓）
 *     与 .card-view-art 矩形的交叠面积（标准 = 0）
 *  ③ 零散文字清单原料：全部可见叶子文本元素（类名/文本/字号/是否按钮内/是否卡内）
 * Usage:
 *   node shots/probe-sweep.mjs stations-desktop|stations-phone
 *   node shots/probe-sweep.mjs endgame-desktop|endgame-phone
 * 前置：npm run build 后 vite preview 在 4173。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2];
const GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SAFE_CSS = ':root{--safe-t:20px !important;--safe-r:62px !important;--safe-b:20px !important;--safe-l:62px !important;}';
fs.mkdirSync('shots/sweep-data', { recursive: true });

async function shot(page, file) {
  const full = path.join(OUT, file);
  try {
    await page.screenshot({ path: full, timeout: 60_000 });
    console.log(`  shot ${file} (pw)`);
    return true;
  } catch (e) {
    console.log(`  shot ${file} failed: ${String(e).slice(0, 80)}`);
    return false;
  }
}

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

async function jumpTo(page, stationIdx, panelTestid, lap = 1) {
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

async function startPage(browser, { phone, lang = 'en', stopAtChar = false }) {
  const ctx = phone
    ? await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript((l) => {
    try {
      window.localStorage.setItem('maicai-lang', l);
    } catch { /* ignore */ }
  }, lang);
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  if (phone) await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  if (stopAtChar) return { ctx, page };
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);
  return { ctx, page };
}

const SWEEP_FN = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  const pathOf = (el) => {
    const cls = (el.className?.baseVal !== undefined ? el.className.baseVal : el.className || '')
      .toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
  };
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) continue;
    const dW = el.scrollWidth - el.clientWidth;
    const dH = el.scrollHeight - el.clientHeight;
    if (dW > 0 || dH > 0) {
      overflow.push({
        sel: pathOf(el),
        text: (el.textContent || '').trim().slice(0, 36),
        dW, dH,
        leaf: el.children.length === 0,
        fs: parseFloat(cs.fontSize),
      });
    }
  }
  // 卡面文字压图：用卡内局部坐标（offset 链）量测——扇形卡带旋转，
  // 包围盒口径会在卡角造出假压图（实测可达 ~100px² 假象）
  const localRect = (el, root) => {
    let x = 0;
    let y = 0;
    let n = el;
    while (n && n !== root) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  };
  let cardOverlap = { max: 0, worst: null };
  for (const card of document.querySelectorAll('.card-view')) {
    const art = card.querySelector('.card-view-art');
    if (!art || !vis(art)) continue;
    const ar = localRect(art, card);
    for (const t of card.querySelectorAll('.card-view-name,.card-view-tag,.card-view-gem,.card-view-kind,.card-view-mark')) {
      if (!vis(t)) continue;
      const r = localRect(t, card);
      const ox = Math.max(0, Math.min(ar.right, r.right) - Math.max(ar.x, r.x));
      const oy = Math.max(0, Math.min(ar.bottom, r.bottom) - Math.max(ar.y, r.y));
      const area = Math.round(ox * oy);
      if (area > cardOverlap.max) {
        cardOverlap = { max: area, worst: { cls: t.className.toString(), text: t.textContent.trim().slice(0, 20) } };
      }
    }
  }
  const stray = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0 || !vis(el)) continue;
    const text = (el.textContent || '').trim();
    if (text.length < 2) continue;
    const cs = getComputedStyle(el);
    stray.push({
      sel: pathOf(el),
      text: text.slice(0, 42),
      fs: parseFloat(cs.fontSize),
      inButton: !!el.closest('button'),
      inCard: !!el.closest('.card-view'),
    });
  }
  return { overflow, cardOverlap, stray };
};

async function sweep(page, vp, screen) {
  await page.waitForTimeout(700);
  const data = await page.evaluate(SWEEP_FN).catch((e) => ({ error: String(e), overflow: [], cardOverlap: { max: -1 }, stray: [] }));
  fs.writeFileSync(`shots/sweep-data/${vp}-${screen}.json`, JSON.stringify(data, null, 1));
  const leaf = (data.overflow || []).filter((o) => o.leaf);
  console.log(`  [sweep ${vp}/${screen}] overflowEls=${data.overflow.length} leafText=${leaf.length} cardTextOnArt=${data.cardOverlap.max}px² stray=${data.stray.length}`);
  for (const o of data.overflow.slice(0, 14)) console.log('    ov', JSON.stringify(o));
  return data;
}

const GEOM_FN = () => {
  const R = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bottom: +r.bottom.toFixed(1) };
  };
  const localRect = (el, root) => {
    let x = 0;
    let y = 0;
    let n = el;
    while (n && n !== root) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  };
  return [...document.querySelectorAll('.card-view')].map((card) => {
    const art = card.querySelector('.card-view-art');
    const board = card.querySelector('.card-view-board');
    const ar = art ? localRect(art, card) : null;
    const texts = {};
    for (const t of card.querySelectorAll('.card-view-name,.card-view-tag,.card-view-gem,.card-view-kind,.card-view-mark')) {
      if (t.offsetWidth === 0) continue;
      const r = localRect(t, card);
      const oy = ar ? Math.max(0, Math.min(ar.bottom, r.bottom) - Math.max(ar.y, r.y)) : 0;
      const ox = ar ? Math.max(0, Math.min(ar.right, r.right) - Math.max(ar.x, r.x)) : 0;
      texts[t.className.toString()] = { rect: R(t), overlapArt: Math.round(ox * oy), text: t.textContent.trim().slice(0, 18) };
    }
    return { card: R(card), art: R(art), board: R(board), texts };
  }).filter((c) => Object.values(c.texts).some((t) => t.overlapArt > 0));
};

const browser = await chromium.launch({ args: GL_ARGS });

/* ================= geometry ================= */
if (MODE === 'geom-desktop' || MODE === 'geom-phone') {
  const phone = MODE.endsWith('phone');
  const vp = phone ? 'phone' : 'desktop';
  const { ctx, page } = await startPage(browser, { phone, stopAtChar: true });
  await page.waitForTimeout(800);
  const dump = {};
  dump.charsel = await page.evaluate(GEOM_FN);
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.waitForTimeout(3000);
  for (const [idx, testid, name] of [[2, 'panel-market', 'market'], [3, 'panel-partner', 'partner'], [4, 'panel-bus', 'bus'], [7, 'panel-store', 'store'], [8, 'panel-cook', 'cook']]) {
    await jumpTo(page, idx, testid, 1);
    await page.waitForTimeout(600);
    dump[name] = await page.evaluate(GEOM_FN);
  }
  await jumpTo(page, 5, 'panel-event', 1);
  await page.locator('[data-testid="weather-moment"]').waitFor({ timeout: 25_000 }).catch(() => null);
  await page.waitForTimeout(1500);
  dump.moment = await page.evaluate(GEOM_FN);
  fs.writeFileSync(`shots/sweep-data/geom-${vp}.json`, JSON.stringify(dump, null, 1));
  for (const [k, v] of Object.entries(dump)) console.log(`  geom ${k}: ${v.length} offending cards`);
  await ctx.close();
}

/* ================= stations ================= */
if (MODE === 'stations-desktop' || MODE === 'stations-phone') {
  const phone = MODE.endsWith('phone');
  const vp = phone ? 'phone' : 'desktop';
  const { ctx, page } = await startPage(browser, { phone, stopAtChar: true });
  await page.waitForTimeout(800);
  await sweep(page, vp, 'charsel');
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);
  const stations = [
    [1, 'panel-drawTask', 'st1-draw'],
    [2, 'panel-market', 'st2-market'],
    [3, 'panel-partner', 'st3-partner'],
    [4, 'panel-bus', 'st4-bus'],
    [5, 'panel-event', 'st5-event'],
    [6, 'panel-parent', 'st6-parent'],
    [7, 'panel-store', 'st7-store'],
    [8, 'panel-cook', 'st8-cook'],
  ];
  for (const [idx, testid, name] of stations) {
    const ok = await jumpTo(page, idx, testid, 1);
    console.log(`  jump st${idx} ok=${ok}`);
    await sweep(page, vp, name);
    if (idx === 5) {
      // 天气时刻（结果卡）再扫一屏
      const m = page.locator('[data-testid="weather-moment"]');
      await m.waitFor({ timeout: 25_000 }).catch(() => null);
      await page.waitForTimeout(1500);
      await sweep(page, vp, 'st5-moment');
    }
  }
  // 钱包抽屉
  const walletBtn = page.locator('[data-testid="btn-wallet"]').first();
  if ((await walletBtn.count()) > 0) {
    await walletBtn.click().catch(() => {});
    await page.locator('[data-testid="drawer-wallet"]').waitFor({ timeout: 10_000 }).catch(() => null);
    await sweep(page, vp, 'wallet');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  // 帮助卡
  const helpBtn = page.locator('[data-testid="btn-help"]').first();
  if ((await helpBtn.count()) > 0) {
    await helpBtn.click().catch(() => {});
    await page.locator('[data-testid="card-help"]').waitFor({ timeout: 10_000 }).catch(() => null);
    await sweep(page, vp, 'help');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  await ctx.close();
}

/* ================= endgame ================= */
if (MODE === 'endgame-desktop' || MODE === 'endgame-phone') {
  const phone = MODE.endsWith('phone');
  const vp = phone ? 'phone' : 'desktop';
  const form = vp;
  const { ctx, page } = await startPage(browser, { phone });
  const STATE_FN = () => ({
    reflection: !!document.querySelector('[data-testid="screen-reflection"]'),
    feast: !!document.querySelector('[data-testid="screen-feast"]'),
    basket: !!document.querySelector('[data-testid="screen-basket"]'),
    pill: !!document.querySelector('[data-testid="await-proposal"]'),
    botThinking: !!document.querySelector('.bot-card--thinking, .phone-bot--on'),
  });
  const advance = () =>
    page
      .evaluate(() => {
        const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
        const no = document.querySelector('[data-testid="proposal-no"]');
        if (vis(no)) {
          no.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }
        const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
        if (primary) {
          primary.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }
        const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
        if (keyed.length) {
          const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      })
      .catch(() => {});
  const hideDemo = async () => {
    const closeBtn = page.locator('[data-testid="demo-close"]');
    if ((await closeBtn.count()) > 0) await closeBtn.dispatchEvent('click').catch(() => {});
    else if ((await page.locator('[data-testid="demo-bar"]').count()) > 0) await page.keyboard.press('d');
    await page.waitForTimeout(600);
  };
  let gotProposal = false;
  let gotBasket = false;
  let gotReflect = false;
  let gotFeast = false;
  const t0 = Date.now();
  let lastAdvance = 0;
  while (Date.now() - t0 < 1_200_000 && !gotFeast) {
    const s = await page.evaluate(STATE_FN).catch(() => null);
    if (s?.pill && !gotProposal) {
      gotProposal = true;
      await hideDemo();
      await sweep(page, vp, 'proposal');
      await shot(page, `r10e_r2fix_proposal_${form}.png`);
      // 截完图再让 advance 去拒绝它，继续推进
    }
    if (s?.basket && !gotBasket) {
      gotBasket = true;
      await sweep(page, vp, 'basket');
    }
    if (s?.reflection && !gotReflect) {
      const hasOpts = await page.locator('.reflection-options .hand-item').count().catch(() => 0);
      if (hasOpts >= 5) {
        gotReflect = true;
        await hideDemo();
        await page.mouse.move(8, 8);
        await page.evaluate(() => {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        });
        await page.waitForTimeout(600);
        await sweep(page, vp, 'reflect');
        await shot(page, `r10e_r2fix_reflect_${form}.png`);
        if (!phone) {
          await page.locator('.reflection-options .hand-item .card-view').first().dispatchEvent('click');
          await page.waitForTimeout(900);
          const openState = await page.evaluate(() => {
            const ro = document.querySelector('.reflection-picked');
            return {
              readout: ro?.textContent?.trim() ?? null,
              stillOptions: document.querySelectorAll('.reflection-options .hand-item').length,
              saidCount: document.querySelectorAll('.reflection-card').length,
            };
          });
          console.log('  [reflect open]', JSON.stringify(openState));
          await shot(page, 'r10e_r2fix_reflect_open_desktop.png');
        }
      }
    }
    if (s?.feast) {
      gotFeast = true;
      await hideDemo();
      await sweep(page, vp, 'feast');
      await shot(page, `r10e_r2fix_feast_${form}.png`);
      break;
    }
    if (s && !s.botThinking) {
      const now = Date.now();
      if (now - lastAdvance >= 250) {
        lastAdvance = now;
        await advance();
      }
    }
    await page.waitForTimeout(150);
  }
  console.log(`  endgame ${vp}: proposal=${gotProposal} basket=${gotBasket} reflect=${gotReflect} feast=${gotFeast} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await ctx.close();
}

await browser.close();
console.log('done');
