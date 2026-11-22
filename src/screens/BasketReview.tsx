/**
 * BasketReview.tsx —— 圈末「我的篮子」（REQUIREMENTS §4.5）。
 * 自己：菜谱进度 + 还缺什么 + 剩余币 + 先等等夹 + 待付夹 + 赠品菜/小玩意；
 * 他人：只看进度一句话（不比较、不排序）。
 */
import { getRecipe } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { missingIngredients } from '../game/selectors';
import { fmt, marketPriceOf } from '../game/stations/shared';
import { cardName, playerDisplayName } from '../i18n/cardText';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from '../components/Button';
import { Coins } from '../components/Coins';
import { MiniCardRow } from '../components/MiniCardRow';
import { BlurText } from '../components/text/BlurText';
import { RecipeCard } from '../components/RecipeCard';
import { AnimatedList } from '../components/reactbits/AnimatedList';

function MiniChips({ ids }: { ids: CardId[] }) {
  if (ids.length === 0) return <span className="screen-note">—</span>;
  // R10 Slice B 轻卡面：芯片行换成一排小 CardView 卡面（纯展示，流程不变）
  return <MiniCardRow ids={ids} />;
}

export function BasketReview({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const human = state.players.find((p) => p.isHuman)!;
  const recipe = human.recipeId ? getRecipe(human.recipeId) : null;
  const total = recipe?.ingredientIds.length ?? 0;
  const missing = missingIngredients(human);

  return (
    <main className="intro-shell" data-testid="screen-basket">
      {/* WS3 C15：屏幕级标题——错峰 + Blur Text 焦点回落 */}
      <BlurText as="h1" className="intro-title intro-title--sm" text={strings.screens.basketTitle} />

      <div className="basket-self">
        <RecipeCard recipeId={human.recipeId} collected={human.collected} />
        {recipe && (
          <p className="screen-note">
            {fmt(strings.screens.progress, { a: human.collected.length, b: total })}
            {missing.length > 0 &&
              ` · ${fmt(strings.panel.recipeMissing, { items: missing.map(cardName).join(', ') })}`}
          </p>
        )}
        {/* 币数与全局口径一致：真金币排 + 旁边的数字（WS3 C4 起走
            Count Up 滚动；「My coins: n」整句只走读屏 aria-label） */}
        <Coins
          count={human.coins}
          label={fmt(strings.game.myCoins, { n: human.coins })}
        />
        {/* B23（React Bits "Animated List"，与 B19 共用移植件）：
            自己篮子各行错峰弹入——内容、账本与版式不变，只加入场动效 */}
        <AnimatedList
          className="basket-lines"
          animation="pop"
          staggerMs={55}
          items={[
            {
              key: 'hold-clip',
              node: (
                <p className="wallet-line">
                  {strings.hud.holdClip}:{' '}
                  {human.holdClip
                    ? `${cardName(human.holdClip)} (${marketPriceOf(human.holdClip)} ${coinWord(marketPriceOf(human.holdClip) ?? 0)})`
                    : strings.hud.empty}
                </p>
              ),
            },
            {
              key: 'bus-debt',
              node: (
                <p className="wallet-line">
                  {strings.hud.busDebt}:{' '}
                  {human.busDebt > 0
                    ? `${human.busDebt} ${coinWord(human.busDebt)}`
                    : strings.hud.empty}
                </p>
              ),
            },
            {
              key: 'extras',
              node: (
                <p className="wallet-line">
                  {strings.screens.extrasLabel}
                  <MiniChips ids={human.extras} />
                </p>
              ),
            },
            ...(human.temptations.length > 0
              ? [
                  {
                    key: 'temptations',
                    node: (
                      <p className="wallet-line">
                        {strings.screens.temptationsLabel}
                        <MiniChips ids={human.temptations} />
                      </p>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <section className="basket-others" aria-label={strings.screens.others}>
        <h2 className="basket-others-title">{strings.screens.others}</h2>
        {/* B23：他人篮子行同一份错峰入场（只展示进度一句话，不比较不排序） */}
        <AnimatedList
          animation="pop"
          staggerMs={70}
          items={state.players
            .filter((p) => !p.isHuman)
            .map((p) => {
              const r = p.recipeId ? getRecipe(p.recipeId) : null;
              return {
                key: p.id,
                node: (
                  <p className="basket-other-line">
                    {playerDisplayName(p)}:{' '}
                    {r
                      ? `${cardName(r.id)} ${p.collected.length}/${r.ingredientIds.length}`
                      : '—'}
                  </p>
                ),
              };
            })}
        />
      </section>

      <Button
        variant="primary"
        data-testid="action-primary"
        data-primary="true"
        data-key={1}
        onClick={() => send({ type: 'ACK' })}
      >
        {strings.screens.basketNext}
      </Button>
    </main>
  );
}
