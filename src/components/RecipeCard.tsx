/**
 * RecipeCard.tsx —— 菜谱卡：材料槽位，买到点亮（底栏与钱包抽屉共用）。
 */
import { getIngredient, getRecipe, recipeMarketTotal } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import type { CardId } from '../game/types';
import { CardIcon } from './CardIcon';

export function RecipeCard({
  recipeId,
  collected,
}: {
  recipeId: CardId | null;
  collected: CardId[];
}) {
  const recipe = recipeId ? getRecipe(recipeId) : null;
  if (!recipe) {
    return <div className="recipe-card recipe-card--empty">{strings.actions.noRecipe}</div>;
  }
  const have = new Set(collected);
  return (
    <div className="recipe-card">
      <p className="recipe-card-title">
        {strings.hud.basket}: <CardIcon icon={recipe.icon} /> {recipe.name} (
        {recipeMarketTotal(recipe)} {coinWord(recipeMarketTotal(recipe))})
      </p>
      <div className="recipe-slots">
        {recipe.ingredientIds.map((id) => {
          const ing = getIngredient(id);
          const got = have.has(id);
          return (
            <div key={id} className={'recipe-slot' + (got ? ' recipe-slot--got' : '')}>
              <span className="recipe-slot-icon" aria-hidden="true">
                {ing && <CardIcon icon={ing.icon} />}
              </span>
              <span className="recipe-slot-name">
                {ing?.name} {ing?.marketPrice} {coinWord(ing?.marketPrice ?? 0)}
                {got ? ' ✓' : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
