/**
 * DrawTaskPanel.tsx —— 01 抽任务卡（练 · 记住目标）。
 * 第 1 圈：「抽一张菜谱卡」；第 2、3 圈：看一眼任务卡（还缺什么 + 好的）。
 */
import { strings } from '../data/strings';
import { missingIngredients } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
import { RecipeCard } from './RecipeCard';

export function DrawTaskPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const pd = state.pendingDecision;
  const me = state.players.find((p) => p.isHuman)!;

  if (pd.kind === 'drawRecipe') {
    return (
      <div className="panel-body">
        <Button
          variant="primary"
          keyHint="1"
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          speakText={strings.actions.drawRecipe}
          onClick={() => send({ type: 'DRAW_RECIPE' })}
        >
          {strings.actions.drawRecipe}
        </Button>
      </div>
    );
  }

  // ack：看一眼任务卡（第 2、3 圈）
  const missing = missingIngredients(me);
  return (
    <div className="panel-body">
      <p className="panel-text">{strings.panel.lookTitle}</p>
      <div className="card-reveal">
        <RecipeCard recipeId={me.recipeId} collected={me.collected} />
      </div>
      <p className="panel-text">
        {missing.length > 0
          ? fmt(strings.panel.recipeMissing, { items: missing.map(cardName).join(', ') })
          : strings.panel.recipeDone}
      </p>
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
