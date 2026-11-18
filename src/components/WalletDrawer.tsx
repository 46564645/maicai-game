/**
 * WalletDrawer.tsx —— G3 钱包抽屉：左「菜谱槽位进度」，右「币数 + 流水 +
 * 先等等夹 + 待付夹 + 自由额度提示」（数据来自 selectors.walletSummary，
 * 纯派生）。外壳复用 StationPopup（横屏居中 / 竖屏底部抽屉），Esc 与
 * ✕ 由覆盖层栈负责关闭。
 */
import { getRecipe } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { walletSummary } from '../game/selectors';
import { fmt, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { GameState, PlayerId } from '../game/types';
import { Coins } from './Coins';
import { MiniCardRow } from './MiniCardRow';
import { RecipeCard } from './RecipeCard';
import { StationPopup } from './StationPopup';

export function WalletDrawer({
  state,
  playerId,
  onClose,
}: {
  state: GameState;
  playerId: PlayerId;
  onClose: () => void;
}) {
  const me = state.players.find((p) => p.id === playerId)!;
  const w = walletSummary(state, playerId);
  const recipe = me.recipeId ? getRecipe(me.recipeId) : null;
  const total = recipe?.ingredientIds.length ?? 0;
  const clipName = me.holdClip ? cardName(me.holdClip) : null;
  const clipPrice = me.holdClip ? marketPriceOf(me.holdClip) : null;

  return (
    <StationPopup title={strings.game.walletTitle} onClose={onClose} testid="drawer-wallet">
      <div className="wallet-grid">
        <section className="wallet-col" aria-label={strings.hud.basket}>
          <RecipeCard recipeId={me.recipeId} collected={me.collected} />
          {recipe && (
            <p className="wallet-line">
              {fmt(strings.screens.progress, { a: me.collected.length, b: total })}
            </p>
          )}
          {/* R10 Slice B 轻卡面：自由买的小玩意/赠品列小卡面（纯展示） */}
          {me.extras.length + me.temptations.length > 0 && (
            <MiniCardRow ids={[...me.extras, ...me.temptations]} />
          )}
        </section>
        <section className="wallet-col" aria-label={strings.hud.wallet}>
          <Coins count={me.coins} label={fmt(strings.game.myCoins, { n: me.coins })} />
          <div className="wallet-lines">
            {w.recentLogs.map((e) => (
              <p key={e.id} className="wallet-line">
                {e.text}
              </p>
            ))}
            <p className="wallet-line">
              {strings.hud.holdClip}:{' '}
              {clipName ? `${clipName} (${clipPrice} ${coinWord(clipPrice ?? 0)})` : strings.hud.empty}
            </p>
            <p className="wallet-line">
              {strings.hud.busDebt}:{' '}
              {me.busDebt > 0 ? `${me.busDebt} ${coinWord(me.busDebt)}` : strings.hud.empty}
            </p>
            <p className="wallet-line wallet-line--hint">
              {fmt(strings.game.walletHint, {
                a: w.missingCost,
                b: w.busDebt,
                c: Math.max(0, w.freeEstimate),
              })}
            </p>
          </div>
        </section>
      </div>
    </StationPopup>
  );
}
