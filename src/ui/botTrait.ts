/**
 * botTrait.ts —— R10 Slice D（play #4 / UI #5）：bot 性格小徽章。
 * 「图标 + 1–2 字短标」全部取自既有数据（cards.json 的 icon 与
 * botPersonalityLabel 的首两字），不新造 bot 数据、不进 src/data：
 *   小稳 🛡️稳妥 / 小冲 ⚡冲动 / 小跟 🐾跟风（en: Ca / Ea / Go 截自标签）
 * 真人玩家恒为 null——徽章只给电脑伙伴，也是回合顺序的非色弱提示。
 * key 就是 cards.json 的 personality 字段（steady/impulsive/follower），
 * 供气泡/头像按人挑 token 配色（--player-steady 等）。
 */
import { cards } from '../data/cards';
import { botPersonalityLabel } from '../i18n/cardText';
import type { Player } from '../game/types';

export interface BotTrait {
  /** cards.json personality 原值：配色/类名依据 */
  key: 'steady' | 'impulsive' | 'follower';
  icon: string;
  /** 1–2 字符短标（既有性格名的前两字） */
  label: string;
}

export function botTrait(p: Player): BotTrait | null {
  if (p.isHuman) return null;
  const bot = cards.bots.find((b) => b.id === p.characterId);
  if (!bot) return null;
  return {
    key: bot.personality,
    icon: bot.icon,
    label: botPersonalityLabel(bot).slice(0, 2),
  };
}
