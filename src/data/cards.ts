/**
 * cards.ts —— cards.json 的类型定义与加载校验。
 * 引擎/界面只从这里读卡牌；所有内容均为占位（status 待确认）。
 */
import rawCards from './cards.json';
import { gameConfig } from '../config/gameConfig';
import type { BotPersonality } from '../game/types';

/* —— 类型 —— */

export type CardStatus = '待确认' | '已确认';
export type CardType =
  | 'recipe'
  | 'ingredient'
  | 'temptation'
  | 'event'
  | 'weather'
  | 'invite'
  | 'character'
  | 'bot';

export interface IngredientCard {
  id: string;
  type: 'ingredient';
  name: string;
  icon: string;
  marketPrice: number;
  status: CardStatus;
}

export interface RecipeCard {
  id: string;
  type: 'recipe';
  name: string;
  icon: string;
  ingredientIds: string[];
  status: CardStatus;
}

export interface TemptationCard {
  id: string;
  type: 'temptation';
  name: string;
  icon: string;
  price: number;
  status: CardStatus;
}

export interface EventEffect {
  coinsDelta?: number; // 得币（统一走 gainCoins，先补车费）
  gainIngredientId?: string; // 获得某材料（进 extras 赠品菜）
}

export interface EventOption {
  label: string;
  coins?: number; // spendOption：要花的币数
  effect?: EventEffect;
}

export interface EventCard {
  id: string;
  type: 'event';
  name: string;
  icon: string;
  weatherIds: string[];
  isGood: boolean;
  text: string;
  spendOption: EventOption;
  freeOption: EventOption;
  status: CardStatus;
}

export interface WeatherCard {
  id: string;
  type: 'weather';
  name: string;
  icon: string;
  status: CardStatus;
}

export interface InviteCard {
  id: string;
  type: 'invite';
  name: string;
  icon: string;
  text: string;
  splitNote: string; // 「一起买」怎么分钱、怎么付【待确认】：默认每人各付自己那份
  minPlayers: number; // 达成人数才各自扣各自的币
  eachCost: number;
  giveCardId: string;
  status: CardStatus;
}

export interface ParentOption {
  id: string;
  icon: string;
  label: string;
  tags: string[]; // 判定「说清」用
  status: CardStatus;
}

export interface ParentQuestion {
  id: string;
  text: string;
  keywords: string[]; // 打字模式的关键词表
  options: ParentOption[]; // 图卡选项（3–4 张）
  status: CardStatus;
}

export interface ParentStationData {
  status: CardStatus;
  intro: string;
  voiceHint: string;
  settleLabel: string;
  approveLine: string;
  fallbackLine: string;
  questions: ParentQuestion[];
}

export interface CharacterCard {
  id: string;
  type: 'character';
  name: string;
  icon: string;
  status: CardStatus;
}

/** 电脑玩家（线框 G1 命名：小稳·稳妥型 / 小冲·冲动型 / 小跟·跟风型） */
export interface BotCard {
  id: string;
  type: 'bot';
  name: string;
  icon: string;
  personality: BotPersonality;
  personalityLabel: string;
  status: CardStatus;
}

export interface BotLine {
  id: string;
  text: string;
  status: CardStatus;
}

export interface ReflectionOption {
  id: string;
  label: string;
  status: CardStatus;
}

export interface ReflectionsData {
  status: CardStatus;
  prompt: string;
  botLines: Record<'steady' | 'impulsive' | 'follower', BotLine[]>;
  humanOptions: ReflectionOption[];
}

export type AnyCard =
  | IngredientCard
  | RecipeCard
  | TemptationCard
  | EventCard
  | WeatherCard
  | InviteCard
  | CharacterCard
  | BotCard;

export interface CardsData {
  version: number;
  status: CardStatus;
  note: string;
  ingredients: IngredientCard[];
  recipes: RecipeCard[];
  temptations: TemptationCard[];
  weather: WeatherCard[];
  events: EventCard[];
  invites: InviteCard[];
  parentStation: ParentStationData;
  characters: CharacterCard[];
  bots: BotCard[];
  reflections: ReflectionsData;
}

/* —— 加载 —— */

export const cards: CardsData = rawCards as CardsData;

/** 平铺出所有「卡级」条目（测试与遍历用） */
export function allCards(data: CardsData = cards): AnyCard[] {
  return [
    ...data.ingredients,
    ...data.recipes,
    ...data.temptations,
    ...data.weather,
    ...data.events,
    ...data.invites,
    ...data.characters,
    ...data.bots,
  ];
}

const ingredientById = new Map(cards.ingredients.map((c) => [c.id, c]));

export function getIngredient(id: string): IngredientCard | undefined {
  return ingredientById.get(id);
}

export function getRecipe(id: string): RecipeCard | undefined {
  return cards.recipes.find((r) => r.id === id);
}

/** 菜谱材料的市场价之和 */
export function recipeMarketTotal(recipe: RecipeCard): number {
  return recipe.ingredientIds.reduce((sum, id) => sum + (getIngredient(id)?.marketPrice ?? 0), 0);
}

/* —— 加载校验（不满足只 console.warn，不中断，方便先看到内容）—— */

export function validateCards(data: CardsData = cards): string[] {
  const warnings: string[] = [];

  for (const recipe of data.recipes) {
    const total = recipeMarketTotal(recipe);
    if (total !== gameConfig.recipeTotal) {
      warnings.push(`菜谱「${recipe.name}」材料价之和为 ${total}，应为 ${gameConfig.recipeTotal}`);
    }
    for (const id of recipe.ingredientIds) {
      if (!ingredientById.has(id)) warnings.push(`菜谱「${recipe.name}」引用未知材料 ${id}`);
    }
  }

  const paid = data.events.filter((e) => !e.isGood).length;
  const goodRatio = data.events.length ? (data.events.length - paid) / data.events.length : 0;
  if (Math.abs(goodRatio - gameConfig.events.goodRatio) > 0.15) {
    warnings.push(`事件卡好事比例 ${goodRatio.toFixed(2)}，期望约 ${gameConfig.events.goodRatio.toFixed(2)}`);
  }

  for (const e of data.events) {
    if (!e.spendOption || !e.freeOption) warnings.push(`事件「${e.name}」缺少花钱/不花钱方案`);
    for (const w of e.weatherIds) {
      if (!data.weather.some((x) => x.id === w)) warnings.push(`事件「${e.name}」引用未知天气 ${w}`);
    }
  }

  for (const q of data.parentStation.questions) {
    if (q.options.length < 3) warnings.push(`家长站问题「${q.text}」图卡不足 3 张`);
  }

  if (warnings.length > 0) {
    console.warn('[cards.json] 校验警告：\n' + warnings.join('\n'));
  }
  return warnings;
}

validateCards();
