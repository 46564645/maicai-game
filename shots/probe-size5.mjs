/** probe-size5.mjs — 五尺寸自适应验收（Thong/ww 合并口径）：
 * 尺寸：667×375（小手机横屏）/ 874×402（手机+安全区）/ 1024×768 / 1280×800 / 1440×900。
 * 每屏量四项：① 叶文字溢出 ② 卡面文字压图（局部坐标） ③ 可点元素高（≥48） ④ 叶子文本字号（≥14）。
 * Usage:
 *   node shots/probe-size5.mjs market-<667|874|1024|1280|1440>
 *   node shots/probe-size5.mjs partner-<size> | store-<size> | reflect-<size>
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

const SIZES = {
  '667': { w: 667, h: 375, phone: true, safe: false },
  '874': { w: 874, h: 402, phone: true, safe: true },
  '1024': { w: 1024, h: 768, phone: false, safe: false },
  '1280': { w: 1280, h: 800, phone: false, safe: false },
  '1440': { w: 1440, h: 900, phone: false, safe: false },
};
const [screen, sizeKey] = MODE.split('-');
const SIZE = SIZES[sizeKey];
if (!SIZE) { console.error('bad mode', MODE); process.exit(1); }

async function shot(page, file) {
  const full = path.join(OUT, file);
  try {
    // 交付帧取动画终态：扇入场/倾斜层在无头 SwiftShader 下会拍到中途相位
    // （名行边缘字形看似被裁，DOM 量测与禁用动画帧均证明布局正确）
    await page.screenshot({ path: full, timeout: 60_000, animations: 'disabled' });
    console.log(`  shot ${file}`);
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

async function startPage(browser) {
  const ctx = SIZE.phone
    ? await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h }, hasTouch: true, isMobile: true })
    : await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', String(e)));
  await page.addInitScript(() => {
    try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  if (SIZE.safe) await page.addStyleTag({ content: SAFE_CSS });
  await page.locator('[data-testid="action-primary"]').click();
  await page.locator('[data-testid^="action-char-"]').first().click();
  await page.locator('[data-testid="screen-game"]').waitFor({ state: 'attached' });
  await page.locator('canvas').waitFor({ timeout: 30_000 }).catch(() => null);
  await page.waitForTimeout(3000);
  return { ctx, page };
}

const METRICS_FN = () => {
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
  const inDemo = (el) => !!el.closest('[data-testid="demo-bar"]');
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
  // ① 溢出（叶文字）
  const overflow = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || inDemo(el)) continue;
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) continue;
    const dW = el.scrollWidth - el.clientWidth;
    const dH = el.scrollHeight - el.clientHeight;
    if (dW > 0 || dH > 0) {
      overflow.push({ sel: pathOf(el), text: (el.textContent || '').trim().slice(0, 30), dW, dH, leaf: el.children.length === 0, fs: parseFloat(cs.fontSize) });
    }
  }
  // ② 卡面文字压图（局部坐标）
  const localRect = (el, root) => {
    let x = 0; let y = 0; let n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
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
      if (area > cardOverlap.max) cardOverlap = { max: area, worst: { cls: t.className.toString(), text: t.textContent.trim().slice(0, 20) } };
    }
  }
  // ③ 可点元素
  const buttons = [];
  for (const el of document.querySelectorAll('button, [role="button"], .hand-item')) {
    if (!vis(el) || inDemo(el)) continue;
    const r = el.getBoundingClientRect();
    buttons.push({ sel: pathOf(el), text: (el.textContent || '').trim().slice(0, 22), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
  }
  // ④ 叶子文本字号
  const fonts = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0 || !vis(el) || inDemo(el)) continue;
    if (/(^|\s)(sr-only|cc-live)(\s|$)/.test(el.className?.toString() ?? '')) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    fonts.push({ sel: pathOf(el), text: text.slice(0, 24), fs: parseFloat(getComputedStyle(el).fontSize) });
  }
  // 布局
  const layout = {
    phoneLand: !!document.querySelector('.game-screen--phone-land'),
    popup: document.querySelector('.popup') ? R(document.querySelector('.popup')) : null,
    floatStack: document.querySelector('.phone-float-stack') ? R(document.querySelector('.phone-float-stack')) : null,
    reflectionHand: document.querySelector('.reflection-hand') ? R(document.querySelector('.reflection-hand')) : null,
    cards: [...document.querySelectorAll('.card-view')].slice(0, 8).map(R),
  };
  return { overflow, cardOverlap, buttons, fonts, layout };
};

async function waitToast(page) {
  for (let i = 0; i < 16; i++) {
    const n = await page.locator('.toast-stack > *').count().catch(() => 0);
    if (n === 0) break;
    await page.waitForTimeout(400);
  }
}

async function metrics(page, label) {
  const m = await page.evaluate(METRICS_FN);
  fs.writeFileSync(`shots/sweep-data/size5-${sizeKey}-${label}.json`, JSON.stringify(m, null, 1));
  const leafOv = m.overflow.filter((o) => o.leaf);
  const below48 = m.buttons.filter((b) => b.h < 48);
  const below14 = m.fonts.filter((f) => f.fs < 14);
  const minBtn = m.buttons.length ? Math.min(...m.buttons.map((b) => b.h)) : null;
  const minFs = m.fonts.length ? Math.min(...m.fonts.map((f) => f.fs)) : null;
  console.log(`  [size5 ${sizeKey}/${label}] leafOv=${leafOv.length} cardOnArt=${m.cardOverlap.max} minBtnH=${minBtn} below48=${below48.length} minFs=${minFs} below14=${below14.length}`);
  return m;
}

const browser = await chromium.launch({ args: GL_ARGS });

if (screen === 'intro') {
  const ctx = await browser.newContext({ viewport: { width: SIZE.w, height: SIZE.h } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { window.localStorage.setItem('maicai-lang', 'en'); } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?board=3d&seed=1&fast=1&demo=1`);
  await page.waitForTimeout(2500);
  const stamp = await page.evaluate(() => document.querySelector('.build-stamp')?.textContent ?? null);
  console.log('  [intro stamp]', stamp);
  await shot(page, `r10e_r2fix_intro_${sizeKey}.png`);
  await ctx.close();
}

if (screen === 'market' || screen === 'partner' || screen === 'store') {
  const cfg = { market: [2, 'panel-market'], partner: [3, 'panel-partner'], store: [7, 'panel-store'] }[screen];
  const { ctx, page } = await startPage(browser);
  const ok = await jumpTo(page, cfg[0], cfg[1], 1);
  console.log(`  jump ${screen} ok=${ok}`);
  await page.waitForTimeout(700);
  if (screen === 'market') {
    // 选第一张卡，让名签/购买行进入画面
    const card = page.locator('.stall-hand .hand-item .card-view, .phone-float-stack .hand-item .card-view').first();
    if ((await card.count()) > 0) await card.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(600);
  }
  // 等 toast（2.5s 瞬态）消退再量测/截图，交付帧不带瞬态遮挡
  await waitToast(page);
  await metrics(page, screen);
  const names = { market: 'market', partner: 'swap', store: 'store' };
  await shot(page, `r10e_r2fix_${names[screen]}_${sizeKey}.png`);
  if (screen === 'partner') {
    // 点「Yes」进入交换阶段，再量一屏（swap-hand 收栏验证）
    const yes = page.locator('.choice-hand .hand-item .card-view').first();
    if ((await yes.count()) > 0) {
      await yes.dispatchEvent('click').catch(() => {});
      await page.locator('.swap-hand').first().waitFor({ timeout: 20_000 }).catch(() => null);
      await page.waitForTimeout(800);
      await waitToast(page);
      await metrics(page, 'partner-swap');
      await shot(page, `r10e_r2fix_swapphase_${sizeKey}.png`);
    }
  }
  await ctx.close();
}

if (screen === 'reflect' || screen === 'reflectjump') {
  const { ctx, page } = await startPage(browser);
  if (screen === 'reflectjump') {
    // 短路径：demo 跳到第 3 圈做饭站，做完即进感想屏（手机全程驱动会卡在市场站）
    const ok = await jumpTo(page, 8, 'panel-cook', 3);
    console.log(`  jump cook-lap3 ok=${ok}`);
  }
  const STATE_FN = () => ({
    reflection: !!document.querySelector('[data-testid="screen-reflection"]'),
    feast: !!document.querySelector('[data-testid="screen-feast"]'),
    pill: !!document.querySelector('[data-testid="await-proposal"]'),
    botThinking: !!document.querySelector('.bot-card--thinking, .phone-bot--on'),
  });
  const advance = () =>
    page.evaluate(() => {
      const vis = (el) => el && el.getClientRects().length > 0 && !el.disabled;
      const no = document.querySelector('[data-testid="proposal-no"]');
      if (vis(no)) { no.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      const primary = [...document.querySelectorAll('[data-testid="action-primary"]')].find(vis);
      if (primary) { primary.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
      const keyed = [...document.querySelectorAll('[data-key]')].filter(vis);
      if (keyed.length) {
        const el = keyed.reduce((a, b) => (Number(b.dataset.key ?? 0) > Number(a.dataset.key ?? 0) ? b : a));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }).catch(() => {});
  const hideDemo = async () => {
    const closeBtn = page.locator('[data-testid="demo-close"]');
    if ((await closeBtn.count()) > 0) await closeBtn.dispatchEvent('click').catch(() => {});
    else if ((await page.locator('[data-testid="demo-bar"]').count()) > 0) await page.keyboard.press('d');
    await page.waitForTimeout(600);
  };
  let gotProposal = false; let gotReflect = false; let gotFeast = false;
  const t0 = Date.now();
  let lastAdvance = 0;
  // 流程是 cook → 开饭屏 → ACK → 感想屏 → 完结：开饭不是终点，不能在开饭处退出
  while (Date.now() - t0 < 1_200_000 && !(gotReflect && gotFeast)) {
    const s = await page.evaluate(STATE_FN).catch(() => null);
    if (s?.pill && !gotProposal) {
      gotProposal = true;
      await hideDemo();
      await waitToast(page);
      await metrics(page, 'proposal');
      await shot(page, `r10e_r2fix_proposal_${sizeKey}.png`);
      if (sizeKey === '1280') await shot(page, 'r10e_r2fix_proposal_desktop.png');
      if (sizeKey === '874') await shot(page, 'r10e_r2fix_proposal_phone.png');
    }
    if (s?.reflection && !gotReflect) {
      // 选项卡可能晚于屏幕本体挂载：重试计数，期间不推进（防两步点选被点穿）
      let hasOpts = 0;
      for (let i = 0; i < 6 && hasOpts < 5; i++) {
        hasOpts = await page.locator('.reflection-options .hand-item').count().catch(() => 0);
        if (hasOpts < 5) await page.waitForTimeout(400);
      }
      if (hasOpts >= 5) {
        gotReflect = true;
        await hideDemo();
        await page.mouse.move(8, 8);
        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
        // 等扇入场 3D 翻转动画落定（~0.8s 时拍会得到中途帧，名行看似被裁——实测 1.5s 落定）
        await page.waitForTimeout(1800);
        await waitToast(page);
        await metrics(page, 'reflect');
        await shot(page, `r10e_r2fix_reflect_${sizeKey}.png`);
        if (sizeKey === '1280') await shot(page, 'r10e_r2fix_reflect_desktop.png');
        if (sizeKey === '874') await shot(page, 'r10e_r2fix_reflect_phone.png');
        await page.locator('.reflection-options .hand-item .card-view').first().dispatchEvent('click');
        await page.waitForTimeout(1400);
        const openState = await page.evaluate(() => {
          const ro = document.querySelector('.reflection-picked');
          return { readout: ro?.textContent?.trim() ?? null, stillOptions: document.querySelectorAll('.reflection-options .hand-item').length, saidCount: document.querySelectorAll('.reflection-card').length };
        });
        console.log('  [reflect open]', JSON.stringify(openState));
        await shot(page, `r10e_r2fix_reflect_open_${sizeKey}.png`);
        if (sizeKey === '1280') await shot(page, 'r10e_r2fix_reflect_open_desktop.png');
        // 二次点击同一张卡 = 提交（两步点选），推进到开饭
        await page.locator('.reflection-options .hand-item .card-view').first().dispatchEvent('click');
        await page.waitForTimeout(1200);
      }
    }
    if (s?.feast && !gotFeast) {
      gotFeast = true;
      await hideDemo();
      await waitToast(page);
      await metrics(page, 'feast');
      await shot(page, `r10e_r2fix_feast_${sizeKey}.png`);
      if (sizeKey === '1280') await shot(page, 'r10e_r2fix_feast_desktop.png');
      if (sizeKey === '874') await shot(page, 'r10e_r2fix_feast_phone.png');
      // 不退出：ACK 之后还有感想屏
    }
    if (s && !s.botThinking && (!s.reflection || gotReflect)) {
      const now = Date.now();
      if (now - lastAdvance >= 250) { lastAdvance = now; await advance(); }
    }
    await page.waitForTimeout(150);
  }
  console.log(`  reflect-drive ${sizeKey}: proposal=${gotProposal} reflect=${gotReflect} feast=${gotFeast} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  await ctx.close();
}

await browser.close();
console.log('done');
