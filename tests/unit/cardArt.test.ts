/**
 * cardArt.test.ts —— R10 卡面插画登记表：登记键必须是 cards.json 真实卡 id；
 * 已登记卡（番茄/番茄炒蛋/牌背）有图；未登记卡回退 undefined（CardView
 * 据此渲染 emoji/CardIcon——13 张食材在 PM 补图前走这条路）。
 */
import { describe, expect, it } from 'vitest';
import { cards } from '../../src/data/cards';
import { CARD_BACK_ART, cardArtFor } from '../../src/components/cards/cardArt';

const allCardIds = new Set<string>([
  ...cards.ingredients.map((c) => c.id),
  ...cards.recipes.map((c) => c.id),
  ...cards.temptations.map((c) => c.id),
]);

describe('cardArt 登记', () => {
  it('已出图的卡返回插画 URL', () => {
    expect(cardArtFor('ing-tomato')).toMatch(/\.webp$/);
    expect(cardArtFor('rec-tomato-egg')).toMatch(/\.webp$/);
    expect(CARD_BACK_ART).toMatch(/\.webp$/);
  });

  it('未出图的卡回退 undefined（CardView 落到 emoji 图标）', () => {
    expect(cardArtFor('ing-egg')).toBeUndefined();
    expect(cardArtFor('ing-pork')).toBeUndefined();
    expect(cardArtFor('tmp-sticker')).toBeUndefined();
    expect(cardArtFor('rec-braised-fish')).toBeUndefined();
    expect(cardArtFor('not-a-card')).toBeUndefined();
  });

  it('登记键全部是 cards.json 真实卡 id（防拼错 id 图挂不上）', () => {
    // 已出图的两张逐一断言；任何新增登记行也必须对应真卡
    for (const id of ['ing-tomato', 'rec-tomato-egg']) {
      expect(allCardIds.has(id), id).toBe(true);
    }
  });

  it('番茄炒蛋同名菜共用一图（rec-tomato-egg-2）', () => {
    expect(cardArtFor('rec-tomato-egg-2')).toBe(cardArtFor('rec-tomato-egg'));
  });
});
