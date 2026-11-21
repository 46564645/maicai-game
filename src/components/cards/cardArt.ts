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
import artCardBack from '../../assets/cards/card-back.png';
import artDishBraisedFish from '../../assets/cards/dish-braised-fish.png';
import artDishPotatoPork from '../../assets/cards/dish-potato-pork.png';
import artDishTofuSoup from '../../assets/cards/dish-tofu-soup.png';
import artDishTomatoEgg from '../../assets/cards/dish-tomato-egg.png';
import artDishVeggieStirfry from '../../assets/cards/dish-veggie-stirfry.png';
import artEventBagBroken from '../../assets/cards/event-bag-broken.png';
import artEventExtraEgg from '../../assets/cards/event-extra-egg.png';
import artEventHelpVendor from '../../assets/cards/event-help-vendor.png';
import artEventHungry from '../../assets/cards/event-hungry.png';
import artEventMuddyShoes from '../../assets/cards/event-muddy-shoes.png';
import artEventNeighborGreens from '../../assets/cards/event-neighbor-greens.png';
import artEventRainUmbrella from '../../assets/cards/event-rain-umbrella.png';
import artEventThirsty from '../../assets/cards/event-thirsty.png';
import artEventWindyHat from '../../assets/cards/event-windy-hat.png';
import artIngredientCarrot from '../../assets/cards/ingredient-carrot.png';
import artIngredientCucumber from '../../assets/cards/ingredient-cucumber.png';
import artIngredientEgg from '../../assets/cards/ingredient-egg.png';
import artIngredientFish from '../../assets/cards/ingredient-fish.png';
import artIngredientGarlic from '../../assets/cards/ingredient-garlic.png';
import artIngredientGinger from '../../assets/cards/ingredient-ginger.png';
import artIngredientGreens from '../../assets/cards/ingredient-greens.png';
import artIngredientMushroom from '../../assets/cards/ingredient-mushroom.png';
import artIngredientPork from '../../assets/cards/ingredient-pork.png';
import artIngredientPotato from '../../assets/cards/ingredient-potato.png';
import artIngredientScallion from '../../assets/cards/ingredient-scallion.png';
import artIngredientTofu from '../../assets/cards/ingredient-tofu.png';
import artIngredientTomato from '../../assets/cards/ingredient-tomato.png';
import artTemptationMarshmallow from '../../assets/cards/temptation-marshmallow.png';
import artTemptationPopsicle from '../../assets/cards/temptation-popsicle.png';
import artTemptationSticker from '../../assets/cards/temptation-sticker.png';
import artTemptationToy from '../../assets/cards/temptation-toy.png';
import artWeatherRainy from '../../assets/cards/weather-rainy.png';
import artWeatherSunny from '../../assets/cards/weather-sunny.png';
import artWeatherWindy from '../../assets/cards/weather-windy.png';

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
 * 全部已登记插画 URL（含牌背，去重）——首次打开缓冲页的「真进度」
 * 预载清单用（src/loadAssets.ts）：逐张建 Image 拉完才算数。
 */
export const CARD_ART_URLS: readonly string[] = [
  ...new Set([...Object.values(artByCardId), artCardBack]),
];

/**
 * 开机预载分级（性能优化轮杠杆 2）：CARD_ART_URLS_BOOT 是「首局必见集」，
 * 缓冲页闸门只等这一集（见 src/loadAssets.ts）——天气（开局先转天气盘）
 * + 菜谱（第 1 站 Recipe Stop 抽卡）+ 食材/诱惑（第 2 站 The Market 摊位，
 * 诱惑混在食材里；邀请卡复用诱惑图，一并在此集）+ 牌背（牌堆全程可见）。
 * 其余卡图（事件图，最早第 5 站 Surprise Stop 才翻开）不在闸门内：
 * 闸门放行后后台续载，未到达前 CardView 有 emoji 回退兜底。
 */
const BOOT_ART_ID_PREFIXES = ['wth-', 'rec-', 'ing-', 'tmp-', 'inv-'] as const;

export const CARD_ART_URLS_BOOT: readonly string[] = [
  ...new Set([
    ...Object.entries(artByCardId)
      .filter(([id]) => BOOT_ART_ID_PREFIXES.some((p) => id.startsWith(p)))
      .map(([, url]) => url),
    artCardBack,
  ]),
];

/**
 * 卡面统一底色（Thong 2026-11-20 定稿，取代 T-1 的逐卡采样底色）：
 * 卡片组成 = 一张纯暖白底卡 + 透明 PNG 直贴 + 下方文字区。全部卡面
 * 共用同一暖白色 #fff6e9（Coinly 奶油白，与 tokens.css 的
 * --card-bg-default 同值）；插画已全部换成透明底 PNG（真 alpha），
 * 直接贴在底卡上，不再需要「底色采样与原图融合」的做法。卡背为
 * 满版设计图（不透明），由 Deck 整幅 cover 贴上。
 */
export const CARD_BASE_BG = '#fff6e9';

/** 牌背底色（深藏青，采样同上） */
export const CARD_BACK_BG = '#06113f';

/** 卡 id → 卡面底色；有图的卡一律回统一暖白底，无图回 undefined */
export function cardBgFor(cardId: string): string | undefined {
  return artByCardId[cardId] ? CARD_BASE_BG : undefined;
}

/** 满幅原画的内缩比例（R6 item 8）：evt-rain-umbrella 的原画本身是
 *  满幅构图（伞面/雨点/水洼都切到画布边），与其他事件图（主体带
 *  留白）不同——直接铺满美术区时看起来像「整卡出血」。渲染时把
 *  这张图缩到 0.86，四周露出卡面底色，回到标准卡面剖面（上图下文、
 *  图含于美术区）。不改原画文件，伞尖仍是原画自身的形状 */
const ART_INSET_BY_ID: Record<string, number> = {
  'evt-rain-umbrella': 0.86,
};

/** 卡 id → 原画内缩比例；无条目回 undefined（不内缩） */
export function cardArtInsetFor(cardId: string): number | undefined {
  return ART_INSET_BY_ID[cardId];
}
