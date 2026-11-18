/**
 * botThink.ts —— R10C（education #3）bot 心里话：把「已有的动作日志」
 * 翻译成贴在 bot 卡上的短理由气泡。只读 LogEntry（playerId + spend.kind
 * + 本地化文案片段），不产生任何新引擎事件。
 * 判定「先等等」日志用 strings.log.held 模板的后半段做 includes 匹配
 * （中英双语安全：片段随当前语言字典走）。
 * R10D（education #5 脚手架）：第 2 圈起气泡只留「先等等」那条，
 * 第 3 圈同；第 1 圈维持全量（lap 由调用方传，默认 1 = 旧行为）。
 */
import { strings } from '../data/strings';
import { botBubbleAllowed } from './supportLevel';
import type { LogEntry, Player } from '../game/types';

export function botThinkLine(
  player: Player,
  entry: LogEntry | undefined,
  lap = 1,
): string | null {
  if (!entry || player.isHuman || !player.personality) return null;
  if (entry.playerId !== player.id) return null;

  // 「把X放进先等等夹」：所有性格的 bot 都说同一句——跟「先等等」按钮同词
  const heldFrag = strings.log.held.split('{item}')[1];
  const isHoldLine = !!(heldFrag && entry.text.includes(heldFrag));
  if (isHoldLine) return strings.think.impulsiveHold;

  // R10D：第 2 圈起其余短理由撤扶持，只剩「先等等」（上面的分支）
  if (!botBubbleAllowed(lap, false)) return null;

  switch (entry.spend?.kind) {
    case 'ingredient':
      return player.personality === 'follower'
        ? strings.think.follower
        : strings.think.steady;
    case 'temptation':
      return player.personality === 'follower'
        ? strings.think.follower
        : strings.think.impulsiveBuy;
    case 'bus':
      return strings.think.busDebt;
    case 'event':
      return strings.think.eventSpend;
    default:
      return null;
  }
}
