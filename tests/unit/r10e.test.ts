/**
 * r10e.test.ts —— R10 Slice E「去框舞台 / 大卡时刻 / 徽章 HUD」单测。
 *
 * 纯助手层：
 *   coinDots        HUD 金币点推导（cap + 尾徽）
 *   weatherMoment   天气电影时刻相位机 / 节奏毫秒 / 布景种别
 *   spotlight       ProfileCard 内容纯派生（名字/头衔/币数/缩略图/状态）
 * CSS 验收（r10d 同款 readFileSync 断言）：
 *   §1 去框   .popup 透明无框 / 遮罩毛玻璃 / 头丸 / foot 去线
 *   §2 时刻   .weather-moment / .moment-card 弹出 / 天气洗色
 *   §3 高光   .spotlight-veil / .pc-* 卡体 / foil 强度 token
 *   §4 物件   .coin-dot / .clip-stack / .iou-token / .help-card-btn
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error —— vitest 运行时是 node，内置模块无类型声明
import { readFileSync } from 'node:fs';
import { coinDots } from '../../src/ui/coinDots';
import {
  nextWeatherPhase,
  weatherCardDelayMs,
  weatherCardPopMs,
  weatherDressFor,
} from '../../src/ui/weatherMoment';
import { spotlightInfo, spotlightStatus } from '../../src/ui/spotlight';
import { cards } from '../../src/data/cards';
import type { Player } from '../../src/game/types';
import { boot } from './helpers';

const readSrc = (rel: string) => readFileSync(`src/${rel}`, 'utf8');
const hudCss = readSrc('hud.css');
const boardCss = readSrc('board.css');
const cardsCss = readSrc('components/cards/cards.css');
const tokensCss = readSrc('theme/tokens.css');
const phoneCss = readSrc('phone.css');

function cssBlock(css: string, selector: string): string {
  const i = css.indexOf(selector);
  expect(i, `缺少选择器 ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

/* ============ coinDots：物理金币点推导 ============ */
describe('coinDots', () => {
  it('币数 ≤ cap 全画，extra=0', () => {
    expect(coinDots(0)).toEqual({ dots: 0, extra: 0 });
    expect(coinDots(6)).toEqual({ dots: 6, extra: 0 });
    expect(coinDots(10)).toEqual({ dots: 10, extra: 0 });
  });
  it('超出 cap 收成 +n 尾徽', () => {
    expect(coinDots(13)).toEqual({ dots: 10, extra: 3 });
    expect(coinDots(7, 5)).toEqual({ dots: 5, extra: 2 });
  });
  it('负数/小数收敛：不为负、向下取整', () => {
    expect(coinDots(-3)).toEqual({ dots: 0, extra: 0 });
    expect(coinDots(4.9, 4)).toEqual({ dots: 4, extra: 0 });
  });
});

/* ============ weatherMoment：电影时刻相位机 ============ */
describe('weatherMoment', () => {
  it('相位：spin →(landed) card →(tap) done；其余事件不迁移', () => {
    expect(nextWeatherPhase('spin', 'landed')).toBe('card');
    expect(nextWeatherPhase('card', 'tap')).toBe('done');
    expect(nextWeatherPhase('spin', 'tap')).toBe('spin'); // 没落定不让跳
    expect(nextWeatherPhase('done', 'landed')).toBe('done');
  });
  it('大卡浮出节奏：正常贴 DOM 轮盘+落定拍，reduced 缩到一眨眼', () => {
    expect(weatherCardDelayMs(false)).toBe(1500);
    expect(weatherCardDelayMs(true)).toBeLessThan(300);
    expect(weatherCardPopMs(false)).toBe(340);
    expect(weatherCardPopMs(true)).toBeLessThan(200);
  });
  it('天气卡 id → 布景种别（三态，未知/null 归 null）', () => {
    expect(weatherDressFor('wth-sunny')).toBe('sunny');
    expect(weatherDressFor('wth-rainy')).toBe('rainy');
    expect(weatherDressFor('wth-windy')).toBe('windy');
    expect(weatherDressFor('evt-01')).toBeNull();
    expect(weatherDressFor(null)).toBeNull();
    expect(weatherDressFor(undefined)).toBeNull();
    // cards.json 里的天气卡全部映射得到（不漏新卡）
    for (const w of cards.weather) {
      expect(weatherDressFor(w.id), w.id).not.toBeNull();
    }
  });
});

/* ============ spotlight：ProfileCard 纯派生 ============ */
describe('spotlight', () => {
  const s = boot(7);
  const human = s.players.find((p) => p.isHuman) as Player;
  const bot = s.players.find((p) => !p.isHuman) as Player;

  it('bot：头衔=性格名、配色走性格 token、缩略图来自已买卡', () => {
    const rich: Player = {
      ...bot,
      coins: 7,
      collected: ['ing-greens'],
      extras: ['ing-fish'],
      temptations: ['inv-sticker'],
    };
    const i = spotlightInfo(rich, true);
    expect(i.acting).toBe(true);
    expect(i.accentVar).toContain('--bot-accent-');
    expect(i.title.length).toBeGreaterThan(0);
    expect(i.thumbs).toEqual(['ing-greens', 'ing-fish', 'inv-sticker']);
    expect(i.thumbsExtra).toBe(0);
    expect(i.missing).toBeNull(); // bot 不展示菜谱缺口
  });
  it('真人：头衔=菜谱名（未抽=角色名）、missing=菜谱缺口数', () => {
    const i0 = spotlightInfo(human, false);
    expect(i0.missing).toBeNull(); // 未抽菜谱不展示
    const withRecipe: Player = {
      ...human,
      recipeId: cards.recipes[0].id,
      collected: [],
    };
    const i1 = spotlightInfo(withRecipe, false);
    expect(i1.missing).toBe(cards.recipes[0].ingredientIds.length);
    expect(i1.accentVar).toBe('var(--player-you)');
  });
  it('缩略图封顶 5 枚 + 余量计数', () => {
    const hoarder: Player = {
      ...bot,
      collected: [
        'ing-greens',
        'ing-fish',
        'ing-pork',
        'ing-egg',
        'ing-tofu',
        'ing-tomato',
        'ing-mushroom',
      ],
    };
    const i = spotlightInfo(hoarder, false);
    expect(i.thumbs).toHaveLength(5);
    expect(i.thumbsExtra).toBe(2);
  });
  it('状态点文案双语可出（行动中 / 等着）', () => {
    expect(spotlightStatus(true).length).toBeGreaterThan(0);
    expect(spotlightStatus(false).length).toBeGreaterThan(0);
    expect(spotlightStatus(true)).not.toBe(spotlightStatus(false));
  });
});

/* ============ §1 去框：.popup 透明 + 遮罩毛玻璃 + 头丸 + foot 去线 ============ */
describe('de-panel CSS', () => {
  it('.popup 不再白底圆角盒子（透明舞台）', () => {
    const b = cssBlock(hudCss, '.popup {');
    expect(b).not.toContain('background:');
    expect(b).not.toContain('border-radius');
    expect(b).not.toContain('box-shadow');
  });
  it('.popup-backdrop 压暗 + 毛玻璃；R2-11 天气时刻同层压暗（不再放轻）', () => {
    const b = cssBlock(hudCss, '.popup-backdrop {');
    expect(b).toContain('background: var(--color-backdrop)');
    expect(b).toContain('backdrop-filter: blur(var(--stage-blur))');
    /* 团队第 2 轮 R2-11：天气 spin/card 与其它卡同一 --color-backdrop 口径，
       旧的 :has(.weather-moment) 稀释（42%）+ 去模糊覆盖必须不存在 */
    expect(hudCss).not.toContain('.popup-backdrop:has(.weather-moment)');
    expect(hudCss).not.toContain('var(--color-backdrop) 42%');
  });
  it('头丸=半透明墨底（--stage-pill-* token）', () => {
    const b = cssBlock(hudCss, '.popup-head {');
    expect(b).toContain('var(--stage-pill-bg)');
    expect(b).toContain('var(--stage-pill-fg)');
    expect(tokensCss).toContain('--stage-pill-bg:');
    expect(tokensCss).toContain('--stage-blur:');
  });
  it('.panel-foot 撤白条底与发丝线', () => {
    const b = cssBlock(hudCss, '.panel-foot {');
    expect(b).not.toContain('background:');
    expect(b).not.toContain('border-top');
  });
  it('钱包/求助牌各自成一只浮卡', () => {
    expect(hudCss).toContain('.popup .wallet-grid,');
    expect(hudCss).toContain('.popup .help-lines');
  });
  it('手机竖栏同步去框', () => {
    const b = cssBlock(phoneCss, '.phone-rail .popup {');
    expect(b).toContain('border: none');
    expect(b).toContain('box-shadow: none');
    expect(phoneCss).toContain('.phone-rail .popup-backdrop');
  });
});

/* ============ §2 大卡时刻 + 天气布景 ============ */
describe('moment & weather dress CSS', () => {
  it('大卡按钮/收进篮子壳层齐（F29-F31：keyframe 收编为 motion 包装器）', () => {
    expect(hudCss).toContain('.moment-card {');
    expect(hudCss).toContain('.weather-moment {');
    expect(hudCss).toContain('.moment-pop-wrap {');
    /* F29/F30/F31（WS5）：moment-pop/moment-pocket/story-sink 三个
       keyframe 与 .event-story--out 类已删——入场走 AnimatedContent
       'moment'，收篮走 FadeContent 'pocket'，下沉走 'sink' */
    expect(hudCss).not.toContain('@keyframes moment-pop');
    expect(hudCss).not.toContain('@keyframes moment-pocket');
    expect(hudCss).not.toContain('@keyframes story-sink');
    expect(hudCss).not.toContain('.event-story--out');
    /* 收进篮子残影壳仍在（FadeContent 'pocket' 的定位出口） */
    expect(hudCss).toContain('.moment-card--pocket');
  });
  it('天气洗色三态挂在 .game-screen.weather--*', () => {
    for (const k of ['sunny', 'rainy', 'windy']) {
      expect(hudCss).toContain(`.game-screen.weather--${k}`);
      expect(tokensCss).toContain(`--weather-tint-${k}:`);
    }
    expect(hudCss).toContain('.board3d::after,');
    expect(hudCss).toContain('.popup-backdrop::before');
  });
});

/* ============ §3 高光帘 + ProfileCard ============ */
describe('spotlight & profile card CSS', () => {
  it('高光帘与 PC 卡骨架存在', () => {
    expect(boardCss).toContain('.spotlight-veil {');
    expect(cardsCss).toContain('.pc-card {');
    expect(cardsCss).toContain('.pc-contact {');
    expect(cardsCss).toContain('.pc-thumb {');
  });
  it('holo 强度受 token 压制（≤0.8 克制档）', () => {
    expect(tokensCss).toContain('--pc-holo-strength:');
    expect(cardsCss).toContain('.pc .tc-foil');
    const m = tokensCss.match(/--pc-holo-strength:\s*([\d.]+)/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeLessThanOrEqual(0.8);
  });
});

/* ============ §4 HUD 物件：金币点 / 卡夹 / 代币 / 求助卡 ============ */
describe('HUD objects CSS', () => {
  it('金币点/卡夹/IOU/求助卡样式齐', () => {
    expect(hudCss).toContain('.coin-dot {');
    expect(hudCss).toContain('.coin-dots-extra {');
    expect(hudCss).toContain('.clip-stack {');
    expect(hudCss).toContain('.iou-token {');
    expect(hudCss).toContain('.help-card-btn {');
    expect(hudCss).toContain('.coin-pile {');
  });
  it('物件尺寸全部走 token（不裸像素）', () => {
    expect(tokensCss).toContain('--coin-dot-size:');
    expect(tokensCss).toContain('--thumb-w:');
    const b = cssBlock(hudCss, '.coin-dot {');
    expect(b).toContain('var(--coin-dot-size)');
  });
  it('徽章卡可点（button.bot-card 光标/聚焦环）', () => {
    expect(boardCss).toContain('button.bot-card {');
    expect(boardCss).toContain('button.bot-card:focus-visible');
    expect(boardCss).toContain('.bot-thumbs {');
    expect(boardCss).toContain('.order-chip-mid {');
  });
});
