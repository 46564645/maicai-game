/**
 * cardArt.test.ts —— R10 卡面插画登记表：登记键必须是 cards.json 真实卡 id；
 * Slice B 后全部食材/菜谱/诱惑/天气/事件卡均有图（MAPPING.md 33 张），
 * 两张邀请卡复用诱惑品图；未知 id 仍回退 undefined（CardView 落到 emoji）。
 */
import { describe, expect, it } from 'vitest';
import { cards } from '../../src/data/cards';
import { CARD_BACK_ART, cardArtFor } from '../../src/components/cards/cardArt';

const allCardIds = new Set<string>([
  ...cards.ingredients.map((c) => c.id),
  ...cards.recipes.map((c) => c.id),
  ...cards.temptations.map((c) => c.id),
  ...cards.weather.map((c) => c.id),
  ...cards.events.map((c) => c.id),
  ...cards.invites.map((c) => c.id),
]);

describe('cardArt 登记', () => {
  it('牌背与全部已出图卡返回插画 URL', () => {
    expect(CARD_BACK_ART).toMatch(/\.png$/);
    for (const id of allCardIds) {
      expect(cardArtFor(id), id).toMatch(/\.png$/);
    }
  });

  it('未知 id 回退 undefined（CardView 落到 emoji 图标）', () => {
    expect(cardArtFor('not-a-card')).toBeUndefined();
    expect(cardArtFor('pq1-opt-1')).toBeUndefined(); // 家长图卡无 PM 插画
    expect(cardArtFor('chr-xiaohe')).toBeUndefined(); // 角色卡不出图
  });

  it('同名菜共用一图（rec-tomato-egg-2）', () => {
    expect(cardArtFor('rec-tomato-egg-2')).toBe(cardArtFor('rec-tomato-egg'));
  });

  it('邀请卡复用对应诱惑品图（MAPPING.md 指定）', () => {
    expect(cardArtFor('inv-popsicle')).toBe(cardArtFor('tmp-popsicle'));
    expect(cardArtFor('inv-sticker')).toBe(cardArtFor('tmp-sticker'));
  });

  it('每类卡抽查一张：食材/菜谱/诱惑/天气/事件图不重名', () => {
    const picked = new Set([
      cardArtFor('ing-egg'),
      cardArtFor('rec-braised-fish'),
      cardArtFor('tmp-toy'),
      cardArtFor('wth-windy'),
      cardArtFor('evt-hungry'),
    ]);
    expect(picked.size).toBe(5);
  });
});
