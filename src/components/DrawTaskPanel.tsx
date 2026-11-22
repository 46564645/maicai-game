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
import { AnimatedContent } from './motion/AnimatedContent';
import { FadeContent } from './motion/FadeContent';
import { FlipCard } from './motion/FlipCard';
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

  /* 收进篮子：F30——残影走 FadeContent 'pocket'（左下 -34vw/30vh 缩
     飞退场，480ms），fly 置位 → 一拍后清 show 触发退出动画，
     AnimatePresence 播完才真卸载（内容态靠最后一次提交帧保留） */
  const pocket = (r: NonNullable<typeof fly>) => {
    setFly(r);
    send({ type: 'DRAW_RECIPE' });
    window.setTimeout(() => setFly(null), 80);
  };

  const ghost = (
    <FadeContent
      show={fly !== null}
      variant="pocket"
      duration={480}
      className="moment-card moment-card--pocket"
      ariaHidden
    >
      {fly && (
        <CardView cardId={fly.id} icon={fly.icon} name={fly.name} price={fly.price} />
      )}
    </FadeContent>
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
                 点一下「收进篮子」，整卡缩飞向篮子位才派发。
                 F29：入场收编为 AnimatedContent 'moment' */
              <AnimatedContent variant="moment">
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
              </AnimatedContent>
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
        {/* 消息减负审计 D7：确认分支的「看一眼你的任务卡」标题行删除
            ——任务卡本体 + 主按钮已经说清这一步 */}
        {/* F23（WS5）：任务卡翻面亮出收编为 FlipCard reveal
            （motion + SPRING_FLIP，原 card-flip keyframe 删除） */}
        <FlipCard
          reveal
          className="card-reveal"
          front={<RecipeCard recipeId={me.recipeId} collected={me.collected} />}
        />
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
