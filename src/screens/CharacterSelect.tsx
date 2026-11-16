/**
 * CharacterSelect.tsx —— 选自己的角色：4 张角色卡，真人选 1 个，
 * 其余自动给电脑玩家。卡片可点、可按 1–4、方向键移动焦点。
 */
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import type { Command } from '../game/types';
import { CardView } from '../components/CardView';

export function CharacterSelect({ send }: { send: (c: Command) => unknown }) {
  return (
    <main className="intro-shell" data-testid="screen-characters">
      <h1 className="intro-title intro-title--sm">{strings.screens.chooseTitle}</h1>
      <p className="intro-tagline">{strings.screens.chooseHint}</p>
      <div className="char-grid">
        {cards.characters.map((c, i) => (
          <CardView
            key={c.id}
            icon={c.icon}
            name={c.name}
            keyHint={String(i + 1)}
            testid={`action-char-${c.id}`}
            dataKey={i + 1}
            onClick={() => send({ type: 'CHOOSE_CHARACTER', characterId: c.id })}
            ariaLabel={c.name}
          />
        ))}
      </div>
    </main>
  );
}
