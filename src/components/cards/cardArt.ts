/**
 * cardArt.ts —— R10 卡面插画登记（PM 出图，逐卡一行）。
 *
 * 键 = cards.json 的卡 id；值 = 打包进 src/assets/cards/ 的插画 URL。
 * CardView 的美术区先查这张表：有 → 渲染 <img>；没有 → 回退 emoji/CardIcon。
 * 卡背图由 Deck/牌背面使用（CARD_BACK_ART）。后续 PM 补图只在这里加行。
 *
 * Slice B：MAPPING.md 的 33 张 v3 插画全部入册——食材 13、菜谱 5
 * （rec-tomato-egg-2 与 rec-tomato-egg 同图）、诱惑 4、天气 3、事件 9；
 * 两张邀请卡复用对应诱惑品图（inv-popsicle→冰棍、inv-sticker→贴纸）。
 */
import artCardBack from '../../assets/cards/card-back.webp';
import artDishBraisedFish from '../../assets/cards/dish-braised-fish.webp';
import artDishPotatoPork from '../../assets/cards/dish-potato-pork.webp';
import artDishTofuSoup from '../../assets/cards/dish-tofu-soup.webp';
import artDishTomatoEgg from '../../assets/cards/dish-tomato-egg.webp';
import artDishVeggieStirfry from '../../assets/cards/dish-veggie-stirfry.webp';
import artEventBagBroken from '../../assets/cards/event-bag-broken.webp';
import artEventExtraEgg from '../../assets/cards/event-extra-egg.webp';
import artEventHelpVendor from '../../assets/cards/event-help-vendor.webp';
import artEventHungry from '../../assets/cards/event-hungry.webp';
import artEventMuddyShoes from '../../assets/cards/event-muddy-shoes.webp';
import artEventNeighborGreens from '../../assets/cards/event-neighbor-greens.webp';
import artEventRainUmbrella from '../../assets/cards/event-rain-umbrella.webp';
import artEventThirsty from '../../assets/cards/event-thirsty.webp';
import artEventWindyHat from '../../assets/cards/event-windy-hat.webp';
import artIngredientCarrot from '../../assets/cards/ingredient-carrot.webp';
import artIngredientCucumber from '../../assets/cards/ingredient-cucumber.webp';
import artIngredientEgg from '../../assets/cards/ingredient-egg.webp';
import artIngredientFish from '../../assets/cards/ingredient-fish.webp';
import artIngredientGarlic from '../../assets/cards/ingredient-garlic.webp';
import artIngredientGinger from '../../assets/cards/ingredient-ginger.webp';
import artIngredientGreens from '../../assets/cards/ingredient-greens.webp';
import artIngredientMushroom from '../../assets/cards/ingredient-mushroom.webp';
import artIngredientPork from '../../assets/cards/ingredient-pork.webp';
import artIngredientPotato from '../../assets/cards/ingredient-potato.webp';
import artIngredientScallion from '../../assets/cards/ingredient-scallion.webp';
import artIngredientTofu from '../../assets/cards/ingredient-tofu.webp';
import artIngredientTomato from '../../assets/cards/ingredient-tomato.webp';
import artTemptationMarshmallow from '../../assets/cards/temptation-marshmallow.webp';
import artTemptationPopsicle from '../../assets/cards/temptation-popsicle.webp';
import artTemptationSticker from '../../assets/cards/temptation-sticker.webp';
import artTemptationToy from '../../assets/cards/temptation-toy.webp';
import artWeatherRainy from '../../assets/cards/weather-rainy.webp';
import artWeatherSunny from '../../assets/cards/weather-sunny.webp';
import artWeatherWindy from '../../assets/cards/weather-windy.webp';

/** 牌背（Deck 顶卡与未翻卡共用） */
export const CARD_BACK_ART: string = artCardBack;

const artByCardId: Record<string, string> = {
  // 食材 13
  'ing-tomato': artIngredientTomato,
  'ing-egg': artIngredientEgg,
  'ing-scallion': artIngredientScallion,
  'ing-greens': artIngredientGreens,
  'ing-cucumber': artIngredientCucumber,
  'ing-potato': artIngredientPotato,
  'ing-carrot': artIngredientCarrot,
  'ing-tofu': artIngredientTofu,
  'ing-mushroom': artIngredientMushroom,
  'ing-pork': artIngredientPork,
  'ing-fish': artIngredientFish,
  'ing-ginger': artIngredientGinger,
  'ing-garlic': artIngredientGarlic,
  // 菜谱 5（番茄炒蛋两张同名卡共用一图）
  'rec-tomato-egg': artDishTomatoEgg,
  'rec-tomato-egg-2': artDishTomatoEgg,
  'rec-veggie-stirfry': artDishVeggieStirfry,
  'rec-potato-pork': artDishPotatoPork,
  'rec-tofu-soup': artDishTofuSoup,
  'rec-braised-fish': artDishBraisedFish,
  // 诱惑品 4
  'tmp-sticker': artTemptationSticker,
  'tmp-marshmallow': artTemptationMarshmallow,
  'tmp-popsicle': artTemptationPopsicle,
  'tmp-toy': artTemptationToy,
  // 邀请卡 2：复用对应诱惑品图（MAPPING.md 指定）
  'inv-popsicle': artTemptationPopsicle,
  'inv-sticker': artTemptationSticker,
  // 天气 3
  'wth-sunny': artWeatherSunny,
  'wth-rainy': artWeatherRainy,
  'wth-windy': artWeatherWindy,
  // 事件 9
  'evt-neighbor-greens': artEventNeighborGreens,
  'evt-help-vendor': artEventHelpVendor,
  'evt-extra-egg': artEventExtraEgg,
  'evt-thirsty': artEventThirsty,
  'evt-bag-broken': artEventBagBroken,
  'evt-rain-umbrella': artEventRainUmbrella,
  'evt-muddy-shoes': artEventMuddyShoes,
  'evt-windy-hat': artEventWindyHat,
  'evt-hungry': artEventHungry,
};

/** 卡 id → 插画 URL；无图回 undefined（调用方回退 emoji 图标） */
export function cardArtFor(cardId: string): string | undefined {
  return artByCardId[cardId];
}

/**
 * 卡 id → 插画自身底色（T-1 统一卡面，Thong 定稿）：卡面背景直接取
 * 插画的底色，图与卡融为一体（无框、无白板）。采样法：对每张
 * 1600×1600 原图取四角各 100×100 区块的均值，再取四角中位数——
 * v3 Coinly 扁平风底色是整幅平涂，四角离散度多在 ±4 以内；个别图
 * 主体探到角区（猪肉/冰棍）用中位数抗离群。2026-11-18 实测采样，
 * 换图时重跑同一采样更新本表。卡背另登（牌背无字，仅作 Deck 底色）。
 */
const bgByCardId: Record<string, string> = {
  'ing-tomato': '#fdedcf',
  'ing-egg': '#fae2bf',
  'ing-scallion': '#f9e9c8',
  'ing-greens': '#feecd2',
  'ing-cucumber': '#fbefd6',
  'ing-potato': '#fcf1df',
  'ing-carrot': '#fce7c0',
  'ing-tofu': '#f8e0b9',
  'ing-mushroom': '#fce8c3',
  'ing-pork': '#f8e3bb',
  'ing-fish': '#fce5bb',
  'ing-ginger': '#fdeccc',
  'ing-garlic': '#feecd0',
  'rec-tomato-egg': '#fdeaca',
  'rec-tomato-egg-2': '#fdeaca',
  'rec-veggie-stirfry': '#fdeacb',
  'rec-potato-pork': '#fde9c9',
  'rec-tofu-soup': '#feeac6',
  'rec-braised-fish': '#f8deb2',
  'tmp-sticker': '#fde5b7',
  'tmp-marshmallow': '#f2e3c2',
  'tmp-popsicle': '#e8dcce',
  'tmp-toy': '#fbe9cc',
  'inv-popsicle': '#e8dcce',
  'inv-sticker': '#fde5b7',
  'wth-sunny': '#fbe5bc',
  'wth-rainy': '#fcebca',
  'wth-windy': '#f8e4be',
  'evt-neighbor-greens': '#feeaca',
  'evt-help-vendor': '#fee9c9',
  'evt-extra-egg': '#fcebd0',
  'evt-thirsty': '#fbeccc',
  'evt-bag-broken': '#fde9c4',
  'evt-rain-umbrella': '#f4d99d',
  'evt-muddy-shoes': '#fceccc',
  'evt-windy-hat': '#fee9ca',
  'evt-hungry': '#fde8c9',
};

/** 牌背底色（深藏青，采样同上） */
export const CARD_BACK_BG = '#06113f';

/** 卡 id → 插画底色；无图回 undefined（调用方用默认卡面色） */
export function cardBgFor(cardId: string): string | undefined {
  return bgByCardId[cardId];
}
