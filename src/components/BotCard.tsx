/**
 * BotCard.tsx —— 电脑玩家小卡：头像/名字/性格/币数/已买小图标；
 * 轮到它时显示「正在想…」高亮。
 */
import { cards, getIngredient } from '../data/cards';
import { strings } from '../data/strings';
import { botPersonalityLabel, playerDisplayName } from '../i18n/cardText';
import { botTrait } from '../ui/botTrait';
import type { CardId, Player } from '../game/types';
import { CardIcon } from './CardIcon';

function cardIcon(id: CardId): string {
  return (
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

export function BotCard({ player, thinking }: { player: Player; thinking: boolean }) {
  const bot = cards.bots.find((b) => b.id === player.characterId);
  const bought = [...player.collected, ...player.extras, ...player.temptations];
  // R10D（play #4 / UI #5）：常驻性格小徽章（图标 + 1–2 字，取自既有数据）
  const trait = botTrait(player);
  return (
    <div
      className={'bot-card' + (thinking ? ' bot-card--thinking' : '')}
      data-testid={`bot-${player.id}`}
      data-bot={player.characterId ?? undefined}
    >
      <span className="bot-card-avatar" aria-hidden="true">
        {bot?.icon ?? '●'}
        {trait && (
          <i className={'bot-trait bot-trait--' + trait.key}>{trait.label}</i>
        )}
      </span>
      <div className="bot-card-info">
        <p className="bot-card-name">
          {playerDisplayName(player)}
          <span className="bot-card-personality">
            {bot ? botPersonalityLabel(bot) : undefined}
          </span>
        </p>
        <p className="bot-card-line">
          {strings.game.botCoins.replace('{n}', String(player.coins))}
        </p>
        <p className="bot-card-line">
          {strings.game.bought}:{' '}
          {bought.length === 0
            ? '—'
            : bought.slice(0, 6).map((id, i) => (
                <span key={`${id}-${i}`} aria-hidden="true">
                  <CardIcon icon={cardIcon(id)} />
                </span>
              ))}
        </p>
        {thinking && <p className="bot-card-thinking">{strings.game.thinking}</p>}
      </div>
    </div>
  );
}
