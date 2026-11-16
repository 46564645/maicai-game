/**
 * BasketReview.tsx —— 圈末「我的篮子」（REQUIREMENTS §4.5）。
 * 自己：菜谱进度 + 还缺什么 + 剩余币 + 先等等夹 + 待付夹 + 赠品菜/小玩意；
 * 他人：只看进度一句话（不比较、不排序）。
 */
import { getIngredient, getRecipe, cards } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { missingIngredients } from '../game/selectors';
import { cardName, fmt, marketPriceOf } from '../game/stations/shared';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from '../components/Button';
import { CardIcon } from '../components/CardIcon';
import { Coins } from '../components/Coins';
import { RecipeCard } from '../components/RecipeCard';

function iconOf(id: CardId): string {
  return (
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

function MiniChips({ ids }: { ids: CardId[] }) {
  if (ids.length === 0) return <span className="screen-note">—</span>;
  return (
    <span className="mini-chips">
      {ids.map((id, i) => (
        <span key={`${id}-${i}`} className="mini-chip" title={cardName(id)}>
          <CardIcon icon={iconOf(id)} />
          {cardName(id)}
        </span>
      ))}
    </span>
  );
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
      <h1 className="intro-title intro-title--sm">{strings.screens.basketTitle}</h1>

      <div className="basket-self">
        <RecipeCard recipeId={human.recipeId} collected={human.collected} />
        {recipe && (
          <p className="screen-note">
            {fmt(strings.screens.progress, { a: human.collected.length, b: total })}
            {missing.length > 0 &&
              ` · ${fmt(strings.panel.recipeMissing, { items: missing.map(cardName).join(', ') })}`}
          </p>
        )}
        <Coins count={human.coins} label={fmt(strings.game.myCoins, { n: human.coins })} />
        <div className="basket-lines">
          <p className="wallet-line">
            {strings.hud.holdClip}:{' '}
            {human.holdClip
              ? `${cardName(human.holdClip)} (${marketPriceOf(human.holdClip)} ${coinWord(marketPriceOf(human.holdClip) ?? 0)})`
              : strings.hud.empty}
          </p>
          <p className="wallet-line">
            {strings.hud.busDebt}:{' '}
            {human.busDebt > 0 ? `${human.busDebt} ${coinWord(human.busDebt)}` : strings.hud.empty}
          </p>
          <p className="wallet-line">
            {strings.screens.extrasLabel}
            <MiniChips ids={human.extras} />
          </p>
          {human.temptations.length > 0 && (
            <p className="wallet-line">
              {strings.screens.temptationsLabel}
              <MiniChips ids={human.temptations} />
            </p>
          )}
        </div>
      </div>

      <section className="basket-others" aria-label={strings.screens.others}>
        <h2 className="basket-others-title">{strings.screens.others}</h2>
        {state.players
          .filter((p) => !p.isHuman)
          .map((p) => {
            const r = p.recipeId ? getRecipe(p.recipeId) : null;
            return (
              <p key={p.id} className="basket-other-line">
                {p.name}: {r ? `${r.name} ${p.collected.length}/${r.ingredientIds.length}` : '—'}
              </p>
            );
          })}
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
