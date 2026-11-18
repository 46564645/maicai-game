/**
 * StorePanel.tsx —— 07 小卖部补买：所有材料都有，每样 = 市场价 + markup。
 * 与菜市场同一套「先选再买下」（ww M4.5.6b 第 8 条）：点卡选中
 * （抬起+橙框，再点同一张取消），底部按钮变成带价格的「买下（N 币）」。
 * 主动作也和菜市场同款（第 7 条）：没选中可买的卡时「走完这一站」
 * 是橙色主按钮（data-primary），选中后「买下」接管。「先等等」夹
 * 在此可按原价买下或放弃。
 * 键盘：←→ 选卡（焦点即选中）· 1..n 选操作；购买规则与价格不变。
 */
import { useEffect, useRef, useState } from 'react';
import { cards, getIngredient } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { coinWord, strings } from '../data/strings';
import { availableCommands, missingIngredients, walletSummary } from '../game/selectors';
import { fmt, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import { adjacentDupCounts } from '../ui/dupBadges';
import { panelHintFor } from '../ui/supportLevel';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { CardView } from './CardView';
import { CoinBar } from './cards/CoinBar';
import { Hand } from './cards/Hand';
import { PlayableGlow } from './cards/PlayableGlow';
import { playSparkAt } from './cards/PlaySpark';
import { TiltCard } from './cards/TiltCard';
import { useDragPlay } from './cards/useDragPlay';
import type { DropZoneRef } from './cards/useDragPlay';
import type { HandItem } from './cards/Hand';

/** 货架扇里的一张缺货卡：drag 层 + PlayableGlow + TiltCard + CardView，
 *  可买时发光；拖到篮子区=买下，点卡=tap-tap 选中（与市场同一套两通道）。 */
function ShelfCard({
  id,
  needed,
  cost,
  selected,
  playable,
  disabled,
  zones,
  onDrop,
  onSelect,
}: {
  id: CardId;
  needed: boolean;
  cost: number;
  selected: boolean;
  playable: boolean;
  disabled: boolean;
  zones: () => DropZoneRef[];
  onDrop: (cardId: CardId, zoneId: string) => void;
  onSelect: (id: CardId) => void;
}) {
  const ing = getIngredient(id);
  const drag = useDragPlay<CardId>({
    enabled: !disabled,
    payload: id,
    zones,
    onDrop,
  });
  const dragCls =
    `hand-drag${drag.dragging ? ' hand-drag--up' : ''}` +
    `${drag.shaking ? ' hand-drag--shake' : ''}`;
  return (
    <>
      <div className={dragCls} ref={drag.ref} style={drag.style}>
        <PlayableGlow
          active={playable}
          className={playable ? '' : 'pglow--dim'}
        >
          <TiltCard
            className="store-tilt"
            glare
            front={
              <CardView
                cardId={id}
                icon={ing?.icon ?? '❔'}
                name={cardName(id)}
                price={cost}
                mark={needed}
                selected={selected}
                disabled={disabled}
                testid={`action-store-${id}`}
                ariaLabel={`${cardName(id)}, ${cost} ${coinWord(cost)}`}
                onClick={() => onSelect(id)}
                onFocus={() => onSelect(id)}
              />
            }
          />
        </PlayableGlow>
      </div>
    </>
  );
}

export function StorePanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const me = state.players.find((p) => p.isHuman)!;
  const sub = state.turn?.sub;
  const boughtHere = sub?.kind === 'store' ? sub.boughtIds : [];
  const missing = missingIngredients(me);
  const cmds = availableCommands(state);
  const cost = (id: CardId) => (getIngredient(id)?.marketPrice ?? 0) + gameConfig.store.markup;
  const canBuy = (id: CardId | null) =>
    id !== null && cmds.some((c) => c.type === 'STORE_BUY' && c.ingredientId === id);
  const canResolveBuy = cmds.some((c) => c.type === 'RESOLVE_HOLD' && c.buy);
  const others = cards.ingredients.filter((i) => !missing.includes(i.id));
  const [selected, setSelected] = useState<CardId | null>(null);

  // 买下一张后清空选中（与菜市场同款）：同一张本站不能再买，
  // 留着选中会让人对着已买的卡再点一次「买下」。再买必须重新点一张。
  const boughtLen = boughtHere.length;
  const prevBoughtLen = useRef(boughtLen);
  useEffect(() => {
    if (boughtLen > prevBoughtLen.current) setSelected(null);
    prevBoughtLen.current = boughtLen;
  }, [boughtLen]);

  const sel = selected ? getIngredient(selected) : null;
  const buySel = canBuy(selected);
  const wallet = walletSummary(state, me.id);
  // 与菜市场同一套主动作逻辑（ww M4.5.6b 第 7/8 条）：没选中可买的卡时
  // 「走完这一站」是橙色主按钮；选中可买卡后「买下」接管主按钮。
  const endPrimary = !buySel;
  const basketRef = useRef<HTMLButtonElement | null>(null);

  let n = 0;
  const kBuy = ++n;
  const kHoldBuy = me.holdClip !== null ? ++n : 0;
  const kHoldDrop = me.holdClip !== null ? ++n : 0;
  const kEnd = ++n;

  const buy = (id: CardId) => {
    playSparkAt(basketRef.current);
    send({ type: 'STORE_BUY', ingredientId: id });
  };

  const zonesFor = (id: CardId) => () =>
    [{ id: 'basket', el: basketRef.current, accepts: canBuy(id) }];

  // 缺货组 = 货架扇（R10 §2.7）；拖拽进篮子区买下，tap-tap=选中→点区买下
  // R10D：相邻同卡贴「×n」徽标（dupBadges）；大浮签归口扇层 name 字段
  const shelfDups = adjacentDupCounts(missing, (id) => id);
  const shelfItems: HandItem[] = missing.map((id, i) => {
    const dup = shelfDups[i];
    return {
      key: id,
      className: selected === id ? 'hand-item--sel' : undefined,
      name: cardName(id),
      badge: dup !== null ? `×${dup}` : undefined,
      speakText: `${cardName(id)}, ${cost(id)} ${coinWord(cost(id))}`,
      node: (
        <ShelfCard
          id={id}
          needed
          cost={cost(id)}
          selected={selected === id}
          playable={canBuy(id)}
          disabled={boughtHere.includes(id)}
          zones={zonesFor(id)}
          onDrop={(cid) => buy(cid)}
          onSelect={(cid) => setSelected(selected === cid ? null : cid)}
        />
      ),
    };
  });

  // 其他组 = 紧凑网格（§2.7），但卡面换成新剖面（cardId 直出美术）
  const storeCard = (id: CardId) => {
    const ing = getIngredient(id);
    if (!ing) return null;
    return (
      <CardView
        key={id}
        cardId={id}
        icon={ing.icon}
        name={cardName(ing.id)}
        price={cost(id)}
        mark={missing.includes(id)}
        selected={selected === id}
        disabled={boughtHere.includes(id)}
        testid={`action-store-${id}`}
        ariaLabel={`${cardName(ing.id)}, ${cost(id)} ${coinWord(cost(id))}`}
        onClick={() => setSelected(selected === id ? null : id)}
        onFocus={() => setSelected(id)}
      />
    );
  };

  // R10D（education #5）：说明句随圈数退场——1 圈整句 / 2 圈图标+短句 / 3 圈撤
  const hint = panelHintFor(state.lap);

  return (
    <div className="panel-body">
      {hint === 'full' && <p className="panel-text">{strings.panel.storeIntro}</p>}
      {hint === 'compact' && (
        <p className="panel-text panel-text--compact">
          <span aria-hidden="true">🏪</span> {strings.panel.storeIntroShort}
        </p>
      )}

      {missing.length > 0 && (
        <section className="store-section">
          <p className="panel-subtitle">{strings.panel.storeMissing}</p>
          <Hand className="store-shelf" items={shelfItems} ariaLabel={strings.panel.storeMissing} />
        </section>
      )}

      <section className="store-section">
        {/* R10D（UI #7）：手机横屏栏内高度紧，「全部食材」挪进弹窗头部
            （Game.tsx 的 aside 位），栏内不再占一行 */}
        <p className="panel-subtitle store-grid-label">{strings.panel.storeAll}</p>
        <div className="store-grid">{others.map((i) => storeCard(i.id))}</div>
      </section>

      <div className="panel-foot">
        {/* 金币条：菜谱还差/车费/自由花三段（R10C education #1） */}
        <CoinBar
          coins={wallet.coins}
          missingCost={wallet.missingCost}
          busDebt={wallet.busDebt}
          spend={sel ? cost(selected!) : 0}
        />
        {sel && (
          <p className="panel-text panel-selected" aria-live="polite">
            <span className="panel-selected-line">
              {strings.panel.selectedMark}
              <CardIcon icon={sel.icon} /> {cardName(sel.id)} ({cost(selected!)}{' '}
              {coinWord(cost(selected!))})
            </span>
            <span className="panel-selected-line">
              {me.coins >= cost(selected!)
                ? fmt(strings.panel.afterBuy, { n: me.coins - cost(selected!) })
                : strings.panel.noCoins}
            </span>
          </p>
        )}
        <div className="panel-actions">
          <Button
            variant="primary"
            keyHint={String(kBuy)}
            innerRef={basketRef}
            className={`drop-zone drop-zone--basket${selected ? ' drop-zone--armed' : ''}`}
            data-testid="action-primary"
            data-primary={endPrimary ? undefined : 'true'}
            data-key={kBuy}
            disabled={!buySel}
            speakText={
              sel ? fmt(strings.actions.buy, { item: cardName(sel.id), n: cost(selected!) }) : undefined
            }
            onClick={() => selected && buy(selected)}
          >
            <span className="dz-icon" aria-hidden="true">
              🧺
            </span>
            {sel ? fmt(strings.panel.buyPriced, { n: cost(selected!) }) : strings.buttons.buy}
          </Button>
        </div>

        {me.holdClip !== null && (
          <div className="hold-resolve">
            <p className="panel-text">
              {fmt(strings.panel.storeHoldLine, {
                item: cardName(me.holdClip),
                n: marketPriceOf(me.holdClip) ?? 0,
              })}
            </p>
            <div className="panel-actions">
              <Button
                variant="secondary"
                keyHint={String(kHoldBuy)}
                data-testid={`action-${kHoldBuy}`}
                data-key={kHoldBuy}
                disabled={!canResolveBuy}
                onClick={(e) => {
                  playSparkAt(e.currentTarget);
                  send({ type: 'RESOLVE_HOLD', buy: true });
                }}
              >
                {strings.panel.holdBuyPrice}
              </Button>
              <Button
                variant="secondary"
                keyHint={String(kHoldDrop)}
                data-testid={`action-${kHoldDrop}`}
                data-key={kHoldDrop}
                onClick={() => send({ type: 'RESOLVE_HOLD', buy: false })}
              >
                {strings.panel.holdDropBtn}
              </Button>
            </div>
          </div>
        )}

        <Button
          variant={endPrimary ? 'primary' : 'secondary'}
          keyHint={String(kEnd)}
          data-testid={`action-${kEnd}`}
          data-primary={endPrimary ? 'true' : undefined}
          data-key={kEnd}
          onClick={() => send({ type: 'END_TURN' })}
        >
          {strings.panel.endTurn}
        </Button>
        <p className="panel-keyhelp panel-keyhelp--kbd">{strings.panel.keyHelp}</p>
      </div>
    </div>
  );
}
