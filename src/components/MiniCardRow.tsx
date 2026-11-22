/**
 * MiniCardRow.tsx —— R10 Slice B 轻卡面处理：一小排展示用 CardView
 * （不可点，纯面），给篮子回顾/钱包抽屉的「已收/小玩意」清单换个卡脸，
 * 不改任何交互流程。窄屏下自动换行。
 *
 * B7（React Bits "Animated List" 改写）：一排小卡换成 AnimatedList 的
 * 错峰弹入——内容与 .mini-cards 版式不变，只接管入场动效。
 * 容器/条目用 <span>（它可能嵌在 <p> 文本行里，span 才合法）。
 */
import { getIngredient, cards } from '../data/cards';
import { cardName } from '../i18n/cardText';
import type { CardId } from '../game/types';
import { CardView } from './CardView';
import { AnimatedList } from './reactbits/AnimatedList';

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
    <AnimatedList
      as="span"
      direction="row"
      animation="pop"
      staggerMs={42}
      className="mini-cards"
      items={ids.map((id, i) => ({
        key: `${id}-${i}`,
        node: <CardView cardId={id} icon={iconOf(id)} name={cardName(id)} />,
      }))}
    />
  );
}
