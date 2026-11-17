/**
 * DrawTaskPanel.tsx —— 01 抽任务卡（练 · 记住目标），R10 Slice A：
 * 第 1 圈「点牌堆抽菜谱卡」改为牌堆翻牌仪式——点牌堆 → 顶卡绕 Y 轴
 * 翻开（正面是这次要抽到的菜谱，recipeDeck[0] 已洗牌定序）→ 翻牌
 * 动画结束后才派发 DRAW_RECIPE，随后弹窗换成任务卡确认条（与旧
 * 「点按钮 → 卡片揭晓」的命令时序等价：状态先行，动画跟随）。
 * 第 2、3 圈：看一眼任务卡（还缺什么 + 好的），命令仍为 ACK。
 */
import { getRecipe, recipeMarketTotal } from '../data/cards';
import { strings } from '../data/strings';
import { missingIngredients } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardView } from './CardView';
import { Deck } from './cards/Deck';
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
    const rid = state.recipeDeck[0];
    const recipe = rid ? getRecipe(rid) : undefined;
    // 牌堆空了（理论上不该发生）→ 回退旧按钮路径，命令不变
    if (!recipe) {
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
    return (
      <div className="panel-body">
        <p className="panel-text">{strings.actions.drawRecipe}</p>
        <div className="deck-stage">
          <Deck
            testid="action-primary"
            dataKey={1}
            ariaLabel={strings.actions.drawRecipe}
            face={
              <CardView
                cardId={recipe.id}
                icon={recipe.icon}
                name={cardName(recipe.id)}
                price={recipeMarketTotal(recipe)}
              />
            }
            onDraw={() => send({ type: 'DRAW_RECIPE' })}
          />
        </div>
      </div>
    );
  }

  // ack：看一眼任务卡（第 2、3 圈；第 1 圈抽完也停在这里确认）
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
