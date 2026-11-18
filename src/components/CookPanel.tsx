/**
 * CookPanel.tsx —— 08 回家一起做饭（第 1、2 圈）：
 * 把已有材料放进自己的盘子位（ACK 确认），随后进「我的篮子」圈末小结。
 * R10 Slice B：已收食材卡逐张飞入组装（stagger 120ms，transform/opacity）；
 * 菜谱集齐的瞬间菜谱卡盖一次 CSS foil 闪光 + PlaySpark（§2.8/§3.3）。
 */
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { getIngredient, getRecipe } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardView } from './CardView';
import { playSparkAt } from './cards/PlaySpark';
import { RecipeCard } from './RecipeCard';

export function CookPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const me = state.players.find((p) => p.isHuman)!;
  const recipe = me.recipeId ? getRecipe(me.recipeId) : null;
  const complete =
    recipe != null && recipe.ingredientIds.every((id) => me.collected.includes(id));
  const recipeRef = useRef<HTMLDivElement | null>(null);
  const sparked = useRef(false);
  useEffect(() => {
    if (complete && !sparked.current) {
      sparked.current = true;
      playSparkAt(recipeRef.current);
    }
  }, [complete]);

  return (
    <div className="panel-body">
      <p className="panel-text">{strings.panel.cookPut}</p>
      <div ref={recipeRef} className={complete ? 'card-foil' : undefined}>
        <RecipeCard recipeId={me.recipeId} collected={me.collected} />
      </div>
      {me.collected.length > 0 && (
        <div className="cook-line" aria-hidden="true">
          {me.collected.map((id, i) => {
            const ing = getIngredient(id);
            return (
              <span key={`${id}-${i}`} className="cook-card" style={{ '--stagger': `${i * 120}ms` } as CSSProperties}>
                <CardView cardId={id} icon={ing?.icon ?? '❔'} name={cardName(id)} />
              </span>
            );
          })}
        </div>
      )}
      {recipe && (
        <p className="panel-text">
          {fmt(strings.screens.progress, {
            a: me.collected.length,
            b: recipe.ingredientIds.length,
          })}
        </p>
      )}
      <Button
        variant="primary"
        keyHint="1"
        data-testid="action-primary"
        data-primary="true"
        data-key={1}
        onClick={() => send({ type: 'ACK' })}
      >
        {strings.actions.ok}
      </Button>
    </div>
  );
}
