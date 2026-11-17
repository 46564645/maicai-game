/**
 * MarketPanel.tsx —— 02 菜市场摊位（G2）。
 * 6 张卡（食材 + 诱惑混排）：点一张选中，再选 买下 / 放进先等等 / 跳过；
 * 「先等等」夹有卡时可按原价买下或放弃；「走完这一站」END_TURN。
 * 键盘：←→ 选卡（焦点即选中）· 1/2/3 选操作；可不可点以 availableCommands 为准。
 */
import { useEffect, useRef, useState } from 'react';
import { cards, getIngredient } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { availableCommands, missingIngredients } from '../game/selectors';
import { fmt, isTemptation, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { CardView } from './CardView';

function cardInfo(id: CardId) {
  const ing = getIngredient(id);
  const tmp = cards.temptations.find((t) => t.id === id);
  return {
    icon: ing?.icon ?? tmp?.icon ?? '❔',
    name: cardName(id),
    price: marketPriceOf(id) ?? 0,
  };
}

export function MarketPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const me = state.players.find((p) => p.isHuman)!;
  const sub = state.turn?.sub;
  const stall = state.market.stall;
  const cmds = availableCommands(state);
  const missing = missingIngredients(me);
  const [selected, setSelected] = useState<CardId | null>(
    () => stall.find((x): x is CardId => x !== null) ?? null,
  );

  // 选中的卡被买走/补走了 → 清空选中，重新点一张
  useEffect(() => {
    if (selected !== null && !stall.includes(selected)) setSelected(null);
  }, [stall, selected]);

  // 买下一张后清空选中：摊位可能还摆着同名的一张，留着选中会让人再点一次「买下」
  // 就多买一份（马教授 M3.7 反馈「买了 鱼」出现两次）。再买必须重新点一张卡。
  const boughtLen = sub?.kind === 'market' ? sub.boughtIds.length : 0;
  const prevBoughtLen = useRef(boughtLen);
  useEffect(() => {
    if (boughtLen > prevBoughtLen.current) setSelected(null);
    prevBoughtLen.current = boughtLen;
  }, [boughtLen]);

  const canBuy = (id: CardId | null) =>
    id !== null && cmds.some((c) => c.type === 'STALL_BUY' && c.cardId === id);
  const canHold = (id: CardId | null) =>
    id !== null && cmds.some((c) => c.type === 'STALL_HOLD' && c.cardId === id);
  const canResolveBuy = cmds.some((c) => c.type === 'RESOLVE_HOLD' && c.buy);
  const sel = selected ? cardInfo(selected) : null;
  const buysLeft = sub?.kind === 'market' ? sub.buysLeft : 0;
  // ww M4.5.5：买完卡（或无可买）后，主动作高亮跳到「走完这一站」
  const endPrimary = !canBuy(selected);

  let n = 0;
  const kBuy = ++n;
  const kHold = ++n;
  const kSkip = ++n;
  const kHoldBuy = me.holdClip !== null ? ++n : 0;
  const kHoldDrop = me.holdClip !== null ? ++n : 0;
  const kEnd = ++n;

  return (
    <div className="panel-body">
      <p className="panel-text">{strings.panel.stallIntro}</p>
      <p className="panel-buysleft">{fmt(strings.panel.buysLeft, { n: buysLeft })}</p>
      <div className="stall-grid">
        {stall.map((id, i) => {
          if (id === null) return <div key={i} className="stall-slot" aria-hidden="true" />;
          const info = cardInfo(id);
          const needed = !isTemptation(id) && missing.includes(id);
          const tag = isTemptation(id)
            ? strings.panel.tagTemptation
            : needed
              ? strings.panel.tagNeeded
              : strings.panel.tagIngredient;
          return (
            <CardView
              key={`${id}-${i}`}
              icon={info.icon}
              name={info.name}
              price={info.price}
              tag={tag}
              mark={needed}
              selected={selected === id}
              testid={`action-stall-${id}`}
              ariaLabel={`${info.name}, ${info.price} ${coinWord(info.price)}`}
              onClick={() => setSelected(id)}
              onFocus={() => setSelected(id)}
            />
          );
        })}
      </div>

      <div className="panel-foot">
        {sel && (
          <p className="panel-text panel-selected" aria-live="polite">
            <span className="panel-selected-line">
              {strings.panel.selectedMark}
              <CardIcon icon={sel.icon} /> {sel.name} ({sel.price} {coinWord(sel.price)})
            </span>
            <span className="panel-selected-line">
              {me.coins >= sel.price
                ? fmt(strings.panel.afterBuy, { n: me.coins - sel.price })
                : strings.panel.noCoins}
            </span>
          </p>
        )}
        {/* --lead：手机横屏竖栏里「Buy」独占第一行整宽，
            「Maybe later」「Skip」并排第二行（ww M4.5.9b，与小卖部一致） */}
        <div className="panel-actions panel-actions--lead">
          <Button
            variant="primary"
            keyHint={String(kBuy)}
            data-testid="action-primary"
            data-primary={endPrimary ? undefined : 'true'}
            data-key={kBuy}
            disabled={!canBuy(selected)}
            speakText={sel ? fmt(strings.actions.buy, { item: sel.name, n: sel.price }) : undefined}
            onClick={() => selected && send({ type: 'STALL_BUY', cardId: selected })}
          >
            {sel ? fmt(strings.panel.buyPriced, { n: sel.price }) : strings.buttons.buy}
          </Button>
          <Button
            variant="secondary"
            keyHint={String(kHold)}
            data-testid={`action-${kHold}`}
            data-key={kHold}
            disabled={!canHold(selected)}
            onClick={() => selected && send({ type: 'STALL_HOLD', cardId: selected })}
          >
            {strings.buttons.hold}
          </Button>
          <Button
            variant="secondary"
            keyHint={String(kSkip)}
            data-testid={`action-${kSkip}`}
            data-key={kSkip}
            disabled={selected === null}
            onClick={() => setSelected(null)}
          >
            {strings.panel.skipCard}
          </Button>
        </div>

        {me.holdClip !== null && (
          <div className="hold-resolve">
            <p className="panel-text">
              {fmt(strings.panel.holdClipLine, {
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
