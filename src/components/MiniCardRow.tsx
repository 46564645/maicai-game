/**
 * MiniCardRow.tsx —— R10 Slice B 轻卡面处理：一小排展示用 CardView
 * （不可点，纯面），给篮子回顾/钱包抽屉的「已收/小玩意」清单换个卡脸，
 * 不改任何交互流程。窄屏下自动换行。
 */
import { getIngredient, cards } from '../data/cards';
import { cardName } from '../i18n/cardText';
import type { CardId } from '../game/types';
import { CardView } from './CardView';

function iconOf(id: CardId): string {
  return (
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

export function MiniCardRow({ ids }: { ids: CardId[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="mini-cards">
      {ids.map((id, i) => (
        <CardView key={`${id}-${i}`} cardId={id} icon={iconOf(id)} name={cardName(id)} />
      ))}
    </span>
  );
}
