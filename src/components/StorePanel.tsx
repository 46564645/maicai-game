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
import { availableCommands, missingIngredients } from '../game/selectors';
import { fmt, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { CardView } from './CardView';

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
  // 与菜市场同一套主动作逻辑（ww M4.5.6b 第 7/8 条）：没选中可买的卡时
  // 「走完这一站」是橙色主按钮；选中可买卡后「买下」接管主按钮。
  const endPrimary = !buySel;

  let n = 0;
  const kBuy = ++n;
  const kHoldBuy = me.holdClip !== null ? ++n : 0;
  const kHoldDrop = me.holdClip !== null ? ++n : 0;
  const kEnd = ++n;

  const storeCard = (id: CardId) => {
    const ing = getIngredient(id);
    if (!ing) return null;
    return (
      <CardView
        key={id}
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

  return (
    <div className="panel-body">
      <p className="panel-text">{strings.panel.storeIntro}</p>

      {missing.length > 0 && (
        <section className="store-section">
          <p className="panel-subtitle">{strings.panel.storeMissing}</p>
          <div className="store-grid">{missing.map(storeCard)}</div>
        </section>
      )}

      <section className="store-section">
        <p className="panel-subtitle">{strings.panel.storeAll}</p>
        <div className="store-grid">{others.map((i) => storeCard(i.id))}</div>
      </section>

      <div className="panel-foot">
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
            data-testid="action-primary"
            data-primary={endPrimary ? undefined : 'true'}
            data-key={kBuy}
            disabled={!buySel}
            speakText={
              sel ? fmt(strings.actions.buy, { item: cardName(sel.id), n: cost(selected!) }) : undefined
            }
            onClick={() => selected && send({ type: 'STORE_BUY', ingredientId: selected })}
          >
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
                onClick={() => send({ type: 'RESOLVE_HOLD', buy: true })}
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
