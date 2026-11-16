import { describe, expect, it } from 'vitest';
import {
  allCards,
  cards,
  getIngredient,
  recipeMarketTotal,
  validateCards,
} from '../../src/data/cards';
import { gameConfig } from '../../src/config/gameConfig';

describe('cards.json', () => {
  it('所有卡牌 status 都是「待确认」', () => {
    for (const card of allCards()) {
      expect(card.status, card.id).toBe('待确认');
    }
    for (const q of cards.parentStation.questions) {
      expect(q.status, q.id).toBe('待确认');
      for (const o of q.options) expect(o.status, o.id).toBe('待确认');
    }
    for (const lines of Object.values(cards.reflections.botLines)) {
      for (const l of lines) expect(l.status, l.id).toBe('待确认');
    }
    for (const o of cards.reflections.humanOptions) {
      expect(o.status, o.id).toBe('待确认');
    }
  });

  it('菜谱 ≥6 张，且每张材料市场价之和 = recipeTotal', () => {
    expect(cards.recipes.length).toBeGreaterThanOrEqual(6);
    for (const recipe of cards.recipes) {
      expect(recipeMarketTotal(recipe), recipe.id).toBe(gameConfig.recipeTotal);
    }
  });

  it('事件卡 ≥9 张，好事约占 1/3', () => {
    expect(cards.events.length).toBeGreaterThanOrEqual(9);
    const good = cards.events.filter((e) => e.isGood).length;
    const ratio = good / cards.events.length;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.5);
  });

  it('每张事件卡都有花钱方案和不花钱方案，且关联已知天气', () => {
    const weatherIds = new Set(cards.weather.map((w) => w.id));
    for (const e of cards.events) {
      expect(e.spendOption, e.id).toBeTruthy();
      expect(e.freeOption, e.id).toBeTruthy();
      expect(typeof e.spendOption.coins, e.id).toBe('number');
      expect(e.weatherIds.length, e.id).toBeGreaterThan(0);
      for (const w of e.weatherIds) expect(weatherIds.has(w), `${e.id} -> ${w}`).toBe(true);
    }
  });

  it('天气决定事件类型（ADAPTATION #2）：晴天只挂好事卡，雨/风只挂两选项事件卡', () => {
    for (const e of cards.events) {
      for (const w of e.weatherIds) {
        if (w === 'wth-sunny') expect(e.isGood, e.id).toBe(true);
        else expect(e.isGood, `${e.id} -> ${w}`).toBe(false);
      }
    }
    // 雨、风两种天气各自都有可抽的两选项事件卡
    for (const w of ['wth-rainy', 'wth-windy']) {
      expect(cards.events.some((e) => e.weatherIds.includes(w)), w).toBe(true);
    }
    // 晴天下至少有一张好事卡（跨天气回退的来源）
    expect(
      cards.events.some((e) => e.isGood && e.weatherIds.includes('wth-sunny')),
    ).toBe(true);
  });

  it('诱惑品价格：贴纸 2、棉花糖 1、冰棍 1、玩具 2', () => {
    const price = (id: string) => cards.temptations.find((t) => t.id === id)?.price;
    expect(price('tmp-sticker')).toBe(2);
    expect(price('tmp-marshmallow')).toBe(1);
    expect(price('tmp-popsicle')).toBe(1);
    expect(price('tmp-toy')).toBe(2);
  });

  it('菜谱引用的材料都存在', () => {
    for (const r of cards.recipes) {
      for (const id of r.ingredientIds) {
        expect(getIngredient(id), `${r.id} -> ${id}`).toBeTruthy();
      }
    }
  });

  it('AI 家长站有 4 问，每问 ≥3 张图卡和关键词', () => {
    expect(cards.parentStation.questions.length).toBe(4);
    for (const q of cards.parentStation.questions) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.keywords.length, q.id).toBeGreaterThan(0);
    }
  });

  it('加载校验无警告', () => {
    expect(validateCards(cards)).toEqual([]);
  });
});
