/**
 * i18n.test.ts —— R6 中英文切换冒烟测试。
 *
 * 覆盖：
 * 1. 默认英文；strings 代理在英文模式下与 en 字典逐键逐字一致
 *    （保证英文模式渲染与 R5 及之前版本不变）。
 * 2. zh 字典与 en 字典键结构完全同构、无空译文。
 * 3. 切到中文后：HUD/开场/选角色/菜市场/开饭等样本键渲染中文
 *    （组件级 renderToStaticMarkup），切回英文恢复。
 * 4. 卡牌/配置文案解析器（cardText）按 id 给出中文名（ww 定名表）。
 * 5. localStorage 持久化：setLang 写入；新会话初始化读回；无记录默认 en。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { enStrings } from '../../src/i18n/en';
import { zhStrings } from '../../src/i18n/zh';
import { getLang, setLang } from '../../src/i18n/store';
import { strings, coinWord } from '../../src/data/strings';
import {
  cardName,
  joinCardNames,
  localizeLogText,
  parentQuestionText,
  playerDisplayName,
  reflectionOptionLabel,
  stationName,
} from '../../src/i18n/cardText';
import { cards } from '../../src/data/cards';
import { Intro } from '../../src/screens/Intro';
import { CharacterSelect } from '../../src/screens/CharacterSelect';
import { MarketPanel } from '../../src/components/MarketPanel';
import { Feast } from '../../src/screens/Feast';
import { boot, jumpTo, patchPlayer, run } from './helpers';

/* localStorage 替身（node 测试环境无 window；store 对缺失环境有降级，
   这里装上替身以验证持久化读写路径）。WS5：motion（framer-motion 的
   ProjectionNode）在 SSR 渲染时会给 window 挂 resize 监听——替身再补
   一组 no-op 事件口，renderToStaticMarkup 走通即可 */
const storageData = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (k: string) => storageData.get(k) ?? null,
    setItem: (k: string, v: string) => void storageData.set(k, v),
    removeItem: (k: string) => void storageData.delete(k),
  },
  addEventListener: () => () => undefined,
  removeEventListener: () => undefined,
};

afterEach(() => {
  setLang('en');
});

/** 递归收集字典叶子路径 */
function leafPaths(obj: unknown, prefix: string[] = []): string[][] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  const out: string[][] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out.push(...leafPaths(v, [...prefix, k]));
  }
  return out;
}
function readPath(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (o, k) =>
      o !== null && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined,
    obj,
  );
}

describe('R6 中英文切换', () => {
  it('默认英文，且 strings 代理与 en 字典逐字一致', () => {
    expect(getLang()).toBe('en');
    for (const path of leafPaths(enStrings)) {
      expect(readPath(strings, path), path.join('.')).toBe(readPath(enStrings, path));
    }
    expect(coinWord(1)).toBe('coin');
    expect(coinWord(3)).toBe('coins');
  });

  it('zh 字典与 en 字典键结构同构、无空译文', () => {
    const enPaths = leafPaths(enStrings).map((p) => p.join('.')).sort();
    const zhPaths = leafPaths(zhStrings).map((p) => p.join('.')).sort();
    expect(zhPaths).toEqual(enPaths);
    for (const path of leafPaths(zhStrings)) {
      const v = readPath(zhStrings, path);
      expect(typeof v, path.join('.')).toBe('string');
      expect((v as string).length, path.join('.')).toBeGreaterThan(0);
    }
  });

  it('HUD/开场/选角色样本键：中文渲染与切回英文', () => {
    const noop = () => undefined;
    // 英文基线
    let html = renderToStaticMarkup(React.createElement(Intro, { send: noop }));
    expect(html).toContain('Let&#x27;s Go Shopping'); // SSR 转义撇号
    expect(html).toContain('Start');
    html = renderToStaticMarkup(React.createElement(CharacterSelect, { send: noop }));
    expect(html).toContain('Sprout');
    expect(html).toContain('Pick a character you like');

    setLang('zh');
    expect(strings.hud.wallet).toBe('我的钱包');
    expect(strings.hud.busDebt).toBe('待付夹');
    expect(strings.panel.buyPriced).toBe('买下（{n} 币）');
    expect(coinWord(3)).toBe('币');
    html = renderToStaticMarkup(React.createElement(Intro, { send: noop }));
    expect(html).toContain('一起去买菜');
    /* 消息减负审计 A5：开局数字卡已从 Intro 迁入新手指南第 3 页，
       Intro 不再渲染该标签；样本键改在字典层断言（指南 Stepper 静态
       渲染只挂当前页，第 3 页的数字片走字典同一键） */
    expect(strings.intro.statCards.recipeTotal.label).toBe('每张菜谱总价');
    html = renderToStaticMarkup(React.createElement(CharacterSelect, { send: noop }));
    expect(html).toContain('选一个你喜欢的角色');
    expect(html).toContain('小禾');
    expect(html).toContain('阿乐');
    expect(html).not.toContain('Sprout');

    setLang('en');
    html = renderToStaticMarkup(React.createElement(CharacterSelect, { send: noop }));
    expect(html).toContain('Sprout');
  });

  it('菜市场面板：中文摊位卡名与按钮', () => {
    const s = jumpTo(boot(), 1, 1, 'p0');
    expect(s.pendingDecision.kind).toBe('marketTurn');
    const noop = () => undefined;
    let html = renderToStaticMarkup(
      React.createElement(MarketPanel, { state: s, send: noop }),
    );
    expect(html).toContain('Buy');
    setLang('zh');
    html = renderToStaticMarkup(React.createElement(MarketPanel, { state: s, send: noop }));
    /* 消息减负审计 C7：市场导引句（stallIntro）已删——原 R2-6 的
       在场断言改为缺席断言；按钮中文样本断言不变 */
    expect(html).not.toContain('点一张卡，先买菜谱上的菜。');
    expect(html).toContain('先等等');
    expect(html).toContain('买下');
    expect(html).not.toContain('Maybe later');
  });

  it('开饭页：中文盘名/菜名/玩家名', () => {
    let s = boot();
    const rec = cards.recipes[0];
    const [a, b, c] = rec.ingredientIds;
    s = patchPlayer(s, 'p0', { recipeId: rec.id, collected: [a, b, c] });
    s = patchPlayer(s, 'p1', { recipeId: rec.id, collected: [a, b] });
    s = jumpTo(s, 3, 7);
    for (let i = 0; i < 4; i++) s = run(s, { type: 'ACK' });
    expect(s.phase).toBe('feast');
    const noop = () => undefined;
    let html = renderToStaticMarkup(React.createElement(Feast, { state: s, send: noop }));
    expect(html).toContain('Dinner time');
    expect(html).toContain('Full plate');
    setLang('zh');
    html = renderToStaticMarkup(React.createElement(Feast, { state: s, send: noop }));
    expect(html).toContain('一起开饭');
    expect(html).toContain('完整的菜');
    expect(html).toContain('简单的菜');
    expect(html).toContain('番茄炒蛋');
    expect(html).toContain('小禾');
    expect(html).toContain('我的钱');
    expect(html).not.toContain('Full plate');
  });

  it('cardText 解析器：按 id 给中文名（ww 定名表）', () => {
    expect(cardName('ing-tomato')).toBe('Tomato');
    expect(stationName('market')).toBe('The Market');
    setLang('zh');
    expect(cardName('ing-tomato')).toBe('番茄');
    expect(cardName('rec-braised-fish')).toBe('红烧鱼');
    expect(cardName('tmp-popsicle')).toBe('冰棍');
    expect(stationName('market')).toBe('菜市场摊位');
    expect(stationName('parent')).toBe('AI 家长站');
    expect(parentQuestionText(cards.parentStation.questions[0])).toBe('你想要几个币？');
    expect(reflectionOptionLabel('rho-4', 'x')).toBe('我先付了车费');
    const human = boot().players.find((p) => p.isHuman)!;
    expect(playerDisplayName(human)).toBe('小禾');
  });

  it('R2-7 joinCardNames：英文逗号拼接、中文顿号拼接', () => {
    const ids = ['ing-scallion', 'ing-ginger', 'ing-garlic'];
    expect(joinCardNames(ids)).toBe('Green Onion, Ginger, Garlic');
    setLang('zh');
    expect(joinCardNames(ids)).toBe('葱、姜、蒜');
  });

  it('R2-7 localizeLogText：中文界面把日志槽位的英文名换成中文名', () => {
    setLang('zh');
    /* 中文模板 + 英文槽位（同语言局内烘焙） */
    expect(localizeLogText('Sprout买了Fish')).toBe('小禾买了鱼');
    expect(localizeLogText('Steady在小卖部买了Sticker')).toBe('小稳在小卖部买了贴纸');
    /* 英文模板整句（切语言前烘焙）→ 按中文模板重渲染；
       holdBought/storeBought 不得被短模板 bought 截胡 */
    expect(localizeLogText('Tag bought Sticker')).toBe('小跟买了贴纸');
    expect(localizeLogText('Zip bought Fish at the old price')).toBe('小冲按原价买下鱼');
    expect(localizeLogText('Sprout traded food with Zip')).toBe('小禾和小冲换了菜');
    expect(localizeLogText('Sprout spun Sunny: "Heavy rain"')).toBe(
      '小禾转到晴天：「大雨」',
    );
    /* 匹配不上日志模板的条目（家长台词/自由文本）原样返回 */
    expect(localizeLogText('好，说清楚了，给你 3 个币。')).toBe('好，说清楚了，给你 3 个币。');
  });

  it('R2-7 localizeLogText：英文界面保持英文整句', () => {
    expect(localizeLogText('Sprout bought Fish')).toBe('Sprout bought Fish');
    expect(localizeLogText('Sprout买了Fish')).toBe('Sprout bought Fish');
    expect(localizeLogText('Zip bought Fish at the old price')).toBe(
      'Zip bought Fish at the old price',
    );
  });

  it('localStorage 持久化：写入 + 新会话读回 + 无记录默认 en', async () => {
    storageData.clear();
    setLang('zh');
    expect(storageData.get('maicai-lang')).toBe('zh');

    vi.resetModules();
    const freshZh = await import('../../src/i18n/store');
    expect(freshZh.getLang()).toBe('zh');

    storageData.clear();
    vi.resetModules();
    const freshEn = await import('../../src/i18n/store');
    expect(freshEn.getLang()).toBe('en');
  });
});
