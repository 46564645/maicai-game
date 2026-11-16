/**
 * CookPanel.tsx —— 08 回家一起做饭（第 1、2 圈）：
 * 把已有材料放进自己的盘子位（ACK 确认），随后进「我的篮子」圈末小结。
 */
import { getRecipe } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
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

  return (
    <div className="panel-body">
      <p className="panel-text">{strings.panel.cookPut}</p>
      <RecipeCard recipeId={me.recipeId} collected={me.collected} />
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
