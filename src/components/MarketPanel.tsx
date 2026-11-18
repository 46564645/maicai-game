/**
 * MarketPanel.tsx —— 02 菜市场摊位（G2），R10 Slice A：
 * 6 张摊卡（食材 + 诱惑混排）成扇形手牌——点选/拖拽两通道等价：
 *   · 拖拽：按住卡 → 卡跟手微倾 → 拖进篮子区=买下 / 留菜夹区=先等等；
 *     未命中或被拒（买不起/不可留）→ 弹簧弹回 + 轻 shake，不弹报错。
 *   · tap-tap：点卡选中（上抬描边）→ 投放区变成大按钮 → 点区打出；
 *     Esc / 跳过 = 取消选中（与旧「选中→点动作按钮」同流程，按钮换区）。
 *   · 键盘：←→/Tab 焦点=选中；1/2/3 = 买/留/跳过；Esc 取消。
 * 可打性仍以 availableCommands 为准（买不起的卡置灰不发光、拖出必弹回）。
 * 「先等等」夹有卡时可按原价买下或放弃；「走完这一站」END_TURN。
 */
import { useEffect, useRef, useState } from 'react';
import { cards, getIngredient } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { availableCommands, missingIngredients, walletSummary } from '../game/selectors';
import { fmt, isTemptation, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import { adjacentDupCounts } from '../ui/dupBadges';
import { panelHintFor } from '../ui/supportLevel';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { CardView } from './CardView';
import { KeyHint } from './KeyHint';
import { CoinBar } from './cards/CoinBar';
import { Hand } from './cards/Hand';
import { PendingChip } from './cards/PendingChip';
import { PlayableGlow } from './cards/PlayableGlow';
import { playSparkAt } from './cards/PlaySpark';
import { TiltCard } from './cards/TiltCard';
import { useDragPlay } from './cards/useDragPlay';
import { usePending } from './cards/usePending';
import type { DropZoneRef } from './cards/useDragPlay';

function cardInfo(id: CardId) {
  const ing = getIngredient(id);
  const tmp = cards.temptations.find((t) => t.id === id);
  return {
    icon: ing?.icon ?? tmp?.icon ?? '❔',
    name: cardName(id),
    price: marketPriceOf(id) ?? 0,
  };
}

/** 一张摊卡：drag 层 + PlayableGlow + TiltCard(检视倾斜/glare) + CardView */
function StallCard({
  id,
  needed,
  tag,
  selected,
  playable,
  sweepKey,
  zones,
  onDrop,
  onSelect,
}: {
  id: CardId;
  needed: boolean;
  tag: string;
  selected: boolean;
  playable: boolean;
  sweepKey: string;
  zones: () => DropZoneRef[];
  onDrop: (cardId: CardId, zoneId: string) => void;
  onSelect: (id: CardId) => void;
}) {
  const info = cardInfo(id);
  const drag = useDragPlay<CardId>({
    enabled: true,
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
          sweepKey={sweepKey}
          className={playable ? '' : 'pglow--dim'}
        >
          <TiltCard
            className="stall-tilt"
            glare
            front={
              <CardView
                cardId={id}
                icon={info.icon}
                name={info.name}
                price={info.price}
                tag={tag}
                mark={needed}
                selected={selected}
                testid={`action-stall-${id}`}
                ariaLabel={`${info.name}, ${info.price} ${coinWord(info.price)}`}
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
  // R10C 后悔窗口：买下先挂起 ~1.5s，撤销片/飞行卡点一下就收回（interaction #2）
  const pending = usePending();
  // 投放区元素（拖拽命中现取 rect；tap-tap 时它们就是普通按钮）
  const basketRef = useRef<HTMLButtonElement | null>(null);
  const holdRef = useRef<HTMLButtonElement | null>(null);

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

  // Esc = 取消选中（tap-tap 的「再点取消」键盘等价）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const canBuy = (id: CardId | null) =>
    id !== null && cmds.some((c) => c.type === 'STALL_BUY' && c.cardId === id);
  const canHold = (id: CardId | null) =>
    id !== null && cmds.some((c) => c.type === 'STALL_HOLD' && c.cardId === id);
  const canResolveBuy = cmds.some((c) => c.type === 'RESOLVE_HOLD' && c.buy);
  const sel = selected ? cardInfo(selected) : null;
  const buysLeft = sub?.kind === 'market' ? sub.buysLeft : 0;
  // ww M4.5.5：买完卡（或无可买）后，主动作高亮跳到「走完这一站」
  const endPrimary = !canBuy(selected);
  // 扫光每次本站访问播一次（同 panel 实例靠 key 区分访问）
  const sweepKey = `${state.lap}:${state.stationIndex}:${state.turn?.orderIndex ?? 0}`;

  const zonesFor = (id: CardId) => () =>
    [
      {
        id: 'basket',
        el: basketRef.current,
        accepts: pending.pendingLabel === null && canBuy(id),
      },
      { id: 'hold', el: holdRef.current, accepts: canHold(id) },
    ] as DropZoneRef[];

  /** 买下统一走后悔窗口：挂起 → 撤销片倒计时 → 到期才派发 STALL_BUY */
  const commitBuy = (cardId: CardId) => {
    const info = cardInfo(cardId);
    pending.arm(info.name, () => {
      // 到账一刻才迸 PlaySpark（§3.3 买入反馈跟着钱走，不跟手走）
      playSparkAt(basketRef.current);
      send({ type: 'STALL_BUY', cardId });
    });
  };

  const onDrop = (cardId: CardId, zoneId: string) => {
    if (zoneId === 'basket') commitBuy(cardId);
    else send({ type: 'STALL_HOLD', cardId });
  };

  let n = 0;
  const kBuy = ++n;
  const kHold = ++n;
  const kSkip = ++n;
  const kHoldBuy = me.holdClip !== null ? ++n : 0;
  const kHoldDrop = me.holdClip !== null ? ++n : 0;
  const kEnd = ++n;

  // R10D（education #6）：扇里相邻的同卡贴「×2」计数徽标——连号同名卡
  // 孩子才分得清是「两张一样的」
  const dupCounts = adjacentDupCounts(stall, (id) => id);

  const handItems = stall.map((id, i) => {
    if (id === null) {
      return {
        key: `slot-${i}`,
        node: <div className="stall-slot" aria-hidden="true" />,
      };
    }
    const needed = !isTemptation(id) && missing.includes(id);
    const tag = isTemptation(id)
      ? strings.panel.tagTemptation
      : needed
        ? strings.panel.tagNeeded
        : strings.panel.tagIngredient;
    const playable = canBuy(id) || canHold(id);
    const info = cardInfo(id);
    const dup = dupCounts[i];
    return {
      key: `${id}-${i}`,
      className: selected === id ? 'hand-item--sel' : undefined,
      // R10D：大浮签归口扇层（选中/聚焦/hover/长按检视都浮它）
      name: info.name,
      badge: dup !== null ? `×${dup}` : undefined,
      speakText: `${info.name}, ${info.price} ${coinWord(info.price)}`,
      node: (
        <StallCard
          id={id}
          needed={needed}
          tag={tag}
          selected={selected === id}
          playable={playable}
          sweepKey={sweepKey}
          zones={zonesFor(id)}
          onDrop={onDrop}
          onSelect={(cid) => setSelected(cid)}
        />
      ),
    };
  });

  const w = walletSummary(state, me.id);
  // R10C lap-1 教练句：孩子第一次进菜市场，用她真缺的菜组成一句话
  const coach =
    state.lap === 1 && missing.length > 0
      ? fmt(strings.panel.coachLine, { items: missing.map(cardName).join('、') })
      : null;
  // R10D（education #5）：说明句随圈数退场——1 圈整句 / 2 圈图标+短句 / 3 圈撤
  const hint = panelHintFor(state.lap);

  return (
    <div className="panel-body">
      {hint === 'full' && <p className="panel-text">{strings.panel.stallIntro}</p>}
      {hint === 'compact' && (
        <p className="panel-text panel-text--compact">
          <span aria-hidden="true">🧺</span> {strings.panel.stallIntroShort}
        </p>
      )}
      <p className="panel-buysleft">{fmt(strings.panel.buysLeft, { n: buysLeft })}</p>
      {coach && <p className="coach-line">{coach}</p>}

      <Hand className="stall-hand" items={handItems} ariaLabel={strings.panel.stallIntro} />

      <div className="panel-foot">
        {/* 金币条：菜谱还差/车费/自由花三段；选中卡的价从自由花端点亮 */}
        <CoinBar
          coins={me.coins}
          missingCost={w.missingCost}
          busDebt={w.busDebt}
          spend={sel ? sel.price : 0}
        />
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

        {/* 两个投放区 = tap-tap 的大按钮；有卡选中时亮描边「能收了」 */}
        {pending.pendingLabel !== null && (
          <PendingChip label={pending.pendingLabel} onCancel={pending.cancel} />
        )}
        <div className="drop-row">
          <button
            type="button"
            ref={basketRef}
            className={`drop-zone drop-zone--basket${selected ? ' drop-zone--armed' : ''}`}
            data-testid="action-primary"
            data-primary={endPrimary ? undefined : 'true'}
            data-key={kBuy}
            disabled={!canBuy(selected) || pending.pendingLabel !== null}
            aria-label={
              sel
                ? fmt(strings.actions.buy, { item: sel.name, n: sel.price })
                : strings.buttons.buy
            }
            onClick={() => selected && commitBuy(selected)}
          >
            <KeyHint value={String(kBuy)} />
            <span className="dz-icon" aria-hidden="true">
              🧺
            </span>
            {sel ? fmt(strings.panel.buyPriced, { n: sel.price }) : strings.buttons.buy}
          </button>
          <button
            type="button"
            ref={holdRef}
            className={`drop-zone drop-zone--hold${selected ? ' drop-zone--armed' : ''}`}
            data-testid={`action-${kHold}`}
            data-key={kHold}
            disabled={!canHold(selected) || pending.pendingLabel !== null}
            onClick={() => selected && send({ type: 'STALL_HOLD', cardId: selected })}
          >
            <KeyHint value={String(kHold)} />
            <span className="dz-icon" aria-hidden="true">
              📎
            </span>
            {strings.buttons.hold}
          </button>
          <Button
            variant="secondary"
            keyHint={String(kSkip)}
            data-testid={`action-${kSkip}`}
            data-key={kSkip}
            disabled={selected === null || pending.pendingLabel !== null}
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
                disabled={!canResolveBuy || pending.pendingLabel !== null}
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
                disabled={pending.pendingLabel !== null}
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
          disabled={pending.pendingLabel !== null}
          onClick={() => send({ type: 'END_TURN' })}
        >
          {strings.panel.endTurn}
        </Button>
        <p className="panel-keyhelp panel-keyhelp--kbd">{strings.panel.keyHelp}</p>
      </div>
    </div>
  );
}
