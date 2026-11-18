/**
 * spotlight.ts —— R10 Slice E（§3）：角色 ProfileCard 高光卡的纯派生。
 * 名字/头衔/配色/币数/买到的小卡缩略图全部从既有 state + cards.json
 * 取（性格名、角色/bot 图标、菜谱名、collected/extras/temptations），
 * 不新造角色数据。
 */
import { cards, getRecipe } from '../data/cards';
import { strings } from '../data/strings';
import { botPersonalityLabel, cardName, playerDisplayName } from '../i18n/cardText';
import { missingIngredients } from '../game/selectors';
import type { CardId, Player } from '../game/types';

export interface SpotlightInfo {
  name: string;
  /** bot → 性格名（稳妥/冲动/跟风）；真人 → 菜谱名（未抽 = 角色名） */
  title: string;
  /** 头像砖图标（cards.json 既有 icon；无外取图片） */
  icon: string;
  /** 玩家配色 CSS 变量（与棋子/徽章同一 token） */
  accentVar: string;
  coins: number;
  /** 菜谱还差几样（真人底行展示；bot/null 不展示） */
  missing: number | null;
  /** 买到的卡 id（已收+赠品+小玩意，最多 5 枚缩略图 + 余量计数） */
  thumbs: CardId[];
  thumbsExtra: number;
  /** 正在行动（状态点绿） / 等着（灰） */
  acting: boolean;
}

export function spotlightInfo(p: Player, acting: boolean): SpotlightInfo {
  const bot = cards.bots.find((b) => b.id === p.characterId);
  const recipe = p.recipeId ? getRecipe(p.recipeId) : undefined;
  const bought = [...p.collected, ...p.extras, ...p.temptations];
  const accentVar = p.isHuman
    ? 'var(--player-you)'
    : bot
      ? `var(--bot-accent-${bot.personality})`
      : 'var(--color-muted)';
  return {
    name: playerDisplayName(p),
    title: bot
      ? botPersonalityLabel(bot)
      : recipe
        ? cardName(recipe.id)
        : (cards.characters.find((c) => c.id === p.characterId)?.name ??
          playerDisplayName(p)),
    icon:
      cards.characters.find((c) => c.id === p.characterId)?.icon ??
      bot?.icon ??
      '🙂',
    accentVar,
    coins: p.coins,
    missing: p.isHuman && recipe ? missingIngredients(p).length : null,
    thumbs: bought.slice(0, 5),
    thumbsExtra: Math.max(0, bought.length - 5),
    acting,
  };
}

/** 状态点文案：行动中 / 等着（双语由 strings 代理出） */
export function spotlightStatus(acting: boolean): string {
  return acting ? strings.hud.spotlightActing : strings.hud.spotlightWaiting;
}
