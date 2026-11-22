/**
 * CharacterSelect.tsx —— 选自己的角色：4 张角色卡，真人选 1 个，
 * 其余自动给电脑玩家。卡片可点、可按 1–4、方向键移动焦点。
 * B21（React Bits "Jelly Radio" 自包含改写）：按下/聚焦那张角色卡
 * 弹簧胀大、左右邻卡让位——纯拾取反馈；网格/角色/选择命令不变。
 */
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { cardName } from '../i18n/cardText';
import type { Command } from '../game/types';
import { CardView } from '../components/CardView';
import { JellyRadio } from '../components/reactbits/JellyRadio';
import { BlurText } from '../components/text/BlurText';

export function CharacterSelect({ send }: { send: (c: Command) => unknown }) {
  return (
    <main className="intro-shell" data-testid="screen-characters">
      {/* WS3 C15：屏幕级标题——错峰 + Blur Text 焦点回落 */}
      <BlurText as="h1" className="intro-title intro-title--sm" text={strings.screens.chooseTitle} />
      {/* 消息减负审计 A9：「点一个小伙伴开始」删——4 张可点卡自明 */}
      <div className="char-grid">
        <JellyRadio>
          {cards.characters.map((c, i) => (
            <CardView
              key={c.id}
              icon={c.icon}
              name={cardName(c.id)}
              keyHint={String(i + 1)}
              testid={`action-char-${c.id}`}
              dataKey={i + 1}
              onClick={() => send({ type: 'CHOOSE_CHARACTER', characterId: c.id })}
              ariaLabel={cardName(c.id)}
            />
          ))}
        </JellyRadio>
      </div>
    </main>
  );
}
