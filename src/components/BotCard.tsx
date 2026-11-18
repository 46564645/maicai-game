/**
 * BotCard.tsx —— R10 Slice E（§4 HUD 节食）：电脑玩家从「信息小卡」
 * 收成一枚徽章——头像（带性格小徽）+ 名签 + 物理金币点 + 买到的
 * 迷你卡砖缩略图；币数/买了什么不再写字。徽章本身是按钮：
 * 点一下弹出 ProfileCard 高光卡（Spotlight），性格徽与头像淡彩
 * 照旧（形状/文字是非色彩线索）。轮到它时仍显示「正在想…」高亮。
 */
import { cards, getIngredient } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { playerDisplayName } from '../i18n/cardText';
import { botTrait } from '../ui/botTrait';
import type { CardId, Player, PlayerId } from '../game/types';
import { CardIcon } from './CardIcon';
import { CoinDots } from './CoinDots';
import { cardArtFor } from './cards/cardArt';

function cardIcon(id: CardId): string {
  return (
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

function MiniThumb({ id }: { id: CardId }) {
  const art = cardArtFor(id);
  return (
    <span className="bot-thumb" data-thumb={id} aria-hidden="true">
      {art ? <img src={art} alt="" draggable={false} /> : <CardIcon icon={cardIcon(id)} />}
    </span>
  );
}

export function BotCard({
  player,
  thinking,
  expanded,
  autoSpot,
  onOpen,
}: {
  player: Player;
  thinking: boolean;
  /** 高光卡是否正开着（aria-expanded） */
  expanded?: boolean;
  /** R1-E3：轮到它时的自动角落高光（~1s，不开全屏帘） */
  autoSpot?: boolean;
  /** 点徽章 → ProfileCard 高光（桌面 spotlight / 手机同帘） */
  onOpen?: (id: PlayerId) => void;
}) {
  const bot = cards.bots.find((b) => b.id === player.characterId);
  const bought = [...player.collected, ...player.extras, ...player.temptations];
  // R10D（play #4 / UI #5）：常驻性格小徽章（图标 + 1–2 字，取自既有数据）
  const trait = botTrait(player);
  return (
    <button
      type="button"
      className={
        'bot-card' +
        (thinking ? ' bot-card--thinking' : '') +
        (autoSpot ? ' bot-card--spot' : '')
      }
      data-testid={`bot-${player.id}`}
      data-bot={player.characterId ?? undefined}
      aria-label={fmt(strings.hud.botChip, {
        name: playerDisplayName(player),
        n: player.coins,
      })}
      aria-expanded={expanded}
      onClick={onOpen ? () => onOpen(player.id) : undefined}
    >
      <span className="bot-card-avatar" aria-hidden="true">
        {bot?.icon ?? '●'}
        {trait && (
          <i className={'bot-trait bot-trait--' + trait.key}>{trait.label}</i>
        )}
      </span>
      <span className="bot-card-body">
        <span className="bot-card-name">
          {playerDisplayName(player)}
          {thinking && (
            <span className="bot-card-thinking">{strings.game.thinking}</span>
          )}
        </span>
        {/* R1-E4：金币点只作辅助，旁边一直有可见数字（读屏仍走按钮 aria-label） */}
        <span className="bot-card-coins">
          <CoinDots n={player.coins} cap={8} />
          <span className="bot-coin-num" aria-hidden="true">{player.coins}</span>
        </span>
        {bought.length > 0 && (
          <span className="bot-thumbs" aria-hidden="true">
            {bought.slice(0, 5).map((id, i) => (
              <MiniThumb key={`${id}-${i}`} id={id} />
            ))}
            {bought.length > 5 && (
              <span className="bot-thumb bot-thumb--more">
                +{bought.length - 5}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}
