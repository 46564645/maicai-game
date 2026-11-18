/**
 * DrawTaskPanel.tsx —— 01 抽任务卡（练 · 记住目标），R10 Slice A：
 * 第 1 圈「点牌堆抽菜谱卡」改为牌堆翻牌仪式——点牌堆 → 顶卡绕 Y 轴
 * 翻开（正面是这次要抽到的菜谱，recipeDeck[0] 已洗牌定序）→ 翻牌
 * 动画结束后才派发 DRAW_RECIPE，随后弹窗换成任务卡确认条（与旧
 * 「点按钮 → 卡片揭晓」的命令时序等价：状态先行，动画跟随）。
 * 第 2、3 圈：看一眼任务卡（还缺什么 + 好的），命令仍为 ACK。
 * R10E（§3 大卡时刻）：翻开的菜谱先以「大卡」停在舞台等孩子点
 * 「收进篮子」——点完整卡缩飞向左下篮子位才派发 DRAW_RECIPE。
 * 命令时序照旧（点牌堆→派发），只是中间多一拍孩子的确认。
 */
import { useState } from 'react';
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
  /* R10E：pop=菜谱大卡已翻出等收；fly=正缩飞向篮子（ghost 残影） */
  const [pop, setPop] = useState(false);
  const [fly, setFly] = useState<null | {
    id: string;
    icon: string;
    name: string;
    price: number | undefined;
  }>(null);

  /** 收进篮子：留下 480ms 缩飞残影（ghost），同时派发命令 */
  const pocket = (r: NonNullable<typeof fly>) => {
    setFly(r);
    send({ type: 'DRAW_RECIPE' });
    window.setTimeout(() => setFly(null), 520);
  };

  const ghost = fly && (
    <div className="moment-card moment-card--pocket" aria-hidden="true">
      <CardView cardId={fly.id} icon={fly.icon} name={fly.name} price={fly.price} />
    </div>
  );

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
    const r = {
      id: recipe.id,
      icon: recipe.icon,
      name: cardName(recipe.id),
      price: recipeMarketTotal(recipe),
    };
    return (
      <>
        {ghost}
        <div className="panel-body">
          <p className="panel-text">{strings.actions.drawRecipe}</p>
          <div className="deck-stage">
            {pop ? (
              /* R10E（§3）：翻开的菜谱以「大卡」停在舞台——
                 点一下「收进篮子」，整卡缩飞向篮子位才派发 */
              <button
                type="button"
                className="moment-card"
                data-testid="action-primary"
                data-key={1}
                data-primary="true"
                aria-label={`${r.name} · ${strings.panel.pocketRecipe}`}
                onClick={() => pocket(r)}
              >
                <CardView
                  cardId={recipe.id}
                  icon={recipe.icon}
                  name={r.name}
                  price={r.price}
                />
                <span className="moment-tap" aria-hidden="true">
                  {strings.panel.pocketRecipe}
                </span>
              </button>
            ) : (
              <Deck
                testid="action-primary"
                dataKey={1}
                ariaLabel={strings.actions.drawRecipe}
                face={
                  <CardView
                    cardId={recipe.id}
                    icon={recipe.icon}
                    name={r.name}
                    price={r.price}
                  />
                }
                onDraw={() => setPop(true)}
              />
            )}
          </div>
        </div>
      </>
    );
  }

  // ack：看一眼任务卡（第 2、3 圈；第 1 圈抽完也停在这里确认）
  const missing = missingIngredients(me);
  return (
    <>
      {ghost}
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
    </>
  );
}
