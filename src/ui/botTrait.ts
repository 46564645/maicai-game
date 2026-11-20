/**
 * botTrait.ts —— R10 Slice D（play #4 / UI #5）：bot 性格派生。
 * 「图标 + 1–2 字短标」取自既有数据（cards.json 的 icon 与
 * botPersonalityLabel 的首两字），不新造 bot 数据、不进 src/data：
 *   小稳 🛡️稳妥 / 小冲 ⚡冲动 / 小跟 🐾跟风（en: Ca / Ea / Go 截自标签）
 * 真人玩家恒为 null——只给电脑伙伴。
 * key 就是 cards.json 的 personality 字段（steady/impulsive/follower），
 * 供心里话气泡按人挑描边色（--bot-accent-*，与棋子/头像淡彩同色）。
 *
 * R-traits 清理：图标+缩写小徽已从所有常驻面撤掉（顺序片、bot 卡、
 * 心里话气泡、手机头像片）——孩子读不懂缩写。全词性格只活在详情
 * 视图：点头像的 ProfileCard 高光卡（pc-badge）与伙伴站详情
 * （swap-row-trait），两处都用 botPersonalityLabel 的既有全名。
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
