/**
 * cardArt.ts —— R10 卡面插画登记（PM 出图，逐卡一行）。
 *
 * 键 = cards.json 的卡 id；值 = 打包进 src/assets/cards/ 的插画 URL。
 * CardView 的美术区先查这张表：有 → 渲染 <img>；没有 → 回退 emoji/CardIcon。
 * 卡背图由 Deck/牌背面使用（CARD_BACK_ART）。后续 PM 补图只在这里加行。
 */
import artCardBack from '../../assets/cards/card-back.webp';
import artDishTomatoEgg from '../../assets/cards/dish-tomato-egg.webp';
import artIngredientTomato from '../../assets/cards/ingredient-tomato.webp';

/** 牌背（Deck 顶卡与未翻卡共用） */
export const CARD_BACK_ART: string = artCardBack;

const artByCardId: Record<string, string> = {
  'ing-tomato': artIngredientTomato,
  'rec-tomato-egg': artDishTomatoEgg,
  'rec-tomato-egg-2': artDishTomatoEgg, // 同名「番茄炒蛋」共用一图
};

/** 卡 id → 插画 URL；无图回 undefined（调用方回退 emoji 图标） */
export function cardArtFor(cardId: string): string | undefined {
  return artByCardId[cardId];
}
