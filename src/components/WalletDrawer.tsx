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
import { cardName, localizeLogText } from '../i18n/cardText';
import type { GameState, PlayerId } from '../game/types';
import { Coins } from './Coins';
import { MiniCardRow } from './MiniCardRow';
import { RecipeCard } from './RecipeCard';
import { StationPopup } from './StationPopup';
import { CoinBar } from './cards/CoinBar';
import { AnimatedList } from './reactbits/AnimatedList';

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
  const myCoinsLabel = fmt(strings.game.myCoins, { n: me.coins });

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
          {/* 币数与全局口径一致：真金币排 + 旁边的数字（WS3 C4 起走
              Count Up 滚动；「My coins: n」整句只走读屏 aria-label） */}
          <Coins count={me.coins} label={myCoinsLabel} />
          {/* 金币条：抽象的「菜谱还差X/车费Y/自由花Z」画成三段金币格 */}
          <CoinBar coins={w.coins} missingCost={w.missingCost} busDebt={w.busDebt} />
          {/* B19（React Bits "Animated List"）：流水/先等等夹/待付夹/提示
              各行错峰弹入——内容与 .wallet-lines 版式不变，只加入场动效；
              不引入删除/划删语义（游戏无删除） */}
          <AnimatedList
            className="wallet-lines"
            animation="pop"
            staggerMs={55}
            items={[
              ...w.recentLogs.map((e) => ({
                key: `log-${e.id}`,
                node: (
                  <p className="wallet-line">
                    {/* R2-7：同 Toast，流水里的日志也按当前语言重渲染槽位名 */}
                    {localizeLogText(e.text)}
                  </p>
                ),
              })),
              {
                key: 'hold-clip',
                node: (
                  <p className="wallet-line">
                    {strings.hud.holdClip}:{' '}
                    {clipName
                      ? `${clipName} (${clipPrice} ${coinWord(clipPrice ?? 0)})`
                      : strings.hud.empty}
                  </p>
                ),
              },
              {
                key: 'bus-debt',
                node: (
                  <p className="wallet-line">
                    {strings.hud.busDebt}:{' '}
                    {me.busDebt > 0
                      ? `${me.busDebt} ${coinWord(me.busDebt)}`
                      : strings.hud.empty}
                  </p>
                ),
              },
              /* 消息减负审计 E5：钱包底的算式复述行（wallet-hint）
                 删除——同一屏已有金币条三段 + 逐行日志，第三次复述
                 同一笔账删；日志/夹/欠费行保留（E6） */
            ]}
          />
        </section>
      </div>
    </StationPopup>
  );
}
