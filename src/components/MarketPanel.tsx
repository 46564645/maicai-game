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
import { createPortal } from 'react-dom';
import { cards, getIngredient } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { availableCommands, missingIngredients, walletSummary } from '../game/selectors';
import { fmt, isTemptation, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import { adjacentDupCounts } from '../ui/dupBadges';
import type { CardId, Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { CardView } from './CardView';
import { KeyHint } from './KeyHint';
import { CoinBar } from './cards/CoinBar';
import { cardArtFor } from './cards/cardArt';
import { Hand } from './cards/Hand';
import { MetaIcon, metaIconLabel, type MetaIconKind } from './cards/MetaIcon';
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

/** 缺菜小图标（R2-6）：卡扇下方说明句左边的缩略——有插画用插画，
 *  没有回退图标圆衬（与 CardView 美术区同一口径），不再文字列缺菜名 */
function MissingIcon({ id }: { id: CardId }) {
  const info = cardInfo(id);
  const art = cardArtFor(id);
  return (
    <span className="stall-guide-icon" title={info.name}>
      {art ? (
        <img src={art} alt="" draggable={false} />
      ) : (
        <CardIcon icon={info.icon} />
      )}
    </span>
  );
}

/** 一张摊卡：drag 层 + PlayableGlow + TiltCard(检视倾斜/glare) + CardView */
function StallCard({
  id,
  needed,
  catIcon,
  selected,
  playable,
  bought,
  sweepKey,
  zones,
  onDrop,
  onSelect,
}: {
  id: CardId;
  needed: boolean;
  /** R6 决策 2：类别记号（needed→'list' 绿勾 / 食材→'food' / 诱惑→'fun'），
   *  取代原文字标签（tagNeeded/tagIngredient/tagTemptation） */
  catIcon: MetaIconKind;
  selected: boolean;
  playable: boolean;
  /** R2-10：本趟已买过同名卡——加「Bought ✓」角标且不整张变灰 */
  bought: boolean;
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
          active={playable && !bought}
          sweepKey={sweepKey}
          className={!playable && !bought ? 'pglow--dim' : ''}
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
                tagIcon={catIcon === 'list' ? undefined : catIcon}
                mark={needed}
                locked={!playable && !bought}
                selected={selected}
                testid={`action-stall-${id}`}
                ariaLabel={
                  bought
                    ? `${info.name}, ${strings.panel.boughtBadge}`
                    : `${info.name}, ${info.price} ${coinWord(info.price)}, ${metaIconLabel(catIcon)}`
                }
                onClick={() => onSelect(id)}
                onFocus={() => onSelect(id)}
              >
                {bought && (
                  <span className="card-view-bought" aria-hidden="true">
                    {strings.panel.boughtBadge} ✓
                  </span>
                )}
              </CardView>
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
  handFloatEl,
  onFirstMarketOpen,
}: {
  state: GameState;
  send: (c: Command) => unknown;
  /** R2-1：手机横屏时卡扇的浮层挂载点（Game 在棋盘区上方提供）；
   *  给了就用 portal 把卡扇送过去浮在压暗棋盘上，桌面不传、原地渲染 */
  handFloatEl?: HTMLElement | null;
  /** R6（ww 建议）：玩家第一次进市场时回调一次（Game 借此让提示条
   *  播一遍三枚类别记号的意思）；一次性标记在本组件内落 localStorage */
  onFirstMarketOpen?: () => void;
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

  // R6（ww 建议，马教授准）：第一次进市场 → 让提示条播一遍三枚
  // 类别记号的意思，仅此一次。标记与语言选择同法存 localStorage
  // （键 maicai-icons-seen）；存不上（隐私模式等）就每次进市场
  // 都播——降级为多播，不报错
  useEffect(() => {
    if (!onFirstMarketOpen) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem('maicai-icons-seen') === '1';
      if (!seen) window.localStorage.setItem('maicai-icons-seen', '1');
    } catch { /* 存储不可用：按未看过处理 */ }
    if (!seen) onFirstMarketOpen();
    // 只在面板挂载时判一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    /* R6 决策 2：类别改记号——诱惑=星星、菜谱里有=绿勾（走 mark）、
       其余食材=胡萝卜；原文字标签不再上卡面 */
    const catIcon: MetaIconKind = isTemptation(id) ? 'fun' : needed ? 'list' : 'food';
    const playable = canBuy(id) || canHold(id);
    // 本趟已买过的同名卡：引擎已排除它的买/留命令（selectors 按
    // boughtIds 过滤），扇里剩下的同名张靠角标说明，不靠变灰
    const bought = sub?.kind === 'market' && sub.boughtIds.includes(id);
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
          catIcon={catIcon}
          selected={selected === id}
          playable={playable}
          bought={bought}
          sweepKey={sweepKey}
          zones={zonesFor(id)}
          onDrop={onDrop}
          onSelect={(cid) => setSelected(cid)}
        />
      ),
    };
  });

  const w = walletSummary(state, me.id);

  const stallHand = (
    <Hand className="stall-hand" items={handItems} ariaLabel={strings.panel.stallIntro} />
  );

  // R2-6（ww 定稿）：面板顶部文字层全撤（原说明长句/短句、教练句、
  // 「还能买 N 张」都不再堆在扇上方）——卡扇下方只留一句说明，
  // 还缺的菜画成小图标排在句左（代掉原教练句的文字名单）。
  // 「还能买 N 张」只在浮签右侧金币角标 ×N 一处（Game/StationPopup
  // 侧），panel-foot 不再重复出文字行。
  // R6（ww Part 2.4）：选中卡的类别记号 + 全名进导引行——点一张卡，
  // 导引行立刻把卡上记号的意思说全（手机/桌面同一面，≥14px）
  const selCatIcon: MetaIconKind | null = selected
    ? isTemptation(selected)
      ? 'fun'
      : missing.includes(selected)
        ? 'list'
        : 'food'
    : null;
  const selName = sel?.name ?? '';
  const stallGuide = (
    <div className="stall-guide">
      {/* R6 N3：≤700 浮层里栏内弹窗头签让位隐藏，站名由导引句带
          （.stall-guide-station 只在 ≤700 浮层中显示，CSS 控制；
          站名与 Game 头签同源 strings.hud.marketTitle + 圈号 ②） */}
      <span className="stall-guide-station" aria-hidden="true">
        {'\u2461'} {strings.hud.marketTitle} ·{' '}
      </span>
      {missing.length > 0 && (
        <span className="stall-guide-icons" aria-hidden="true">
          {missing.map((id) => (
            <MissingIcon key={id} id={id} />
          ))}
        </span>
      )}
      <span className="stall-guide-text">
        {selCatIcon ? (
          <>
            <MetaIcon kind={selCatIcon} /> {selName} — {metaIconLabel(selCatIcon)}
          </>
        ) : (
          strings.panel.stallIntro
        )}
      </span>
    </div>
  );

  // 卡扇 + 说明行：手机横屏一起走 portal 浮到棋盘区；桌面档说明行
  // 改放 panel-foot 首行（S-4）——旧版放在卡扇下方（面板体末行），
  // 矮视口下弹窗总高超限、sticky 的 foot 初始态就盖住说明行并压住
  // 金币条标签（1024 实测导引句 × 数字重叠 75.4px²）。说明行进 foot
  // 后与金币条同流排布，结构上不可能再相叠；手机浮层里仍在扇下方
  const stallFanBlock = (
    <div className="stall-fan-block">
      {stallHand}
      {handFloatEl ? stallGuide : null}
    </div>
  );

  /* R2 验收修复（ww 第 2 轮截图验收）：主操作（投放区 + 先等等处理 +
     Done）抽成一块——手机横屏时跟卡扇一起走 portal 浮到棋盘区
     （竖栏 402 高塞不下 头+金币条+选中行+三行按钮，Buy/Done 被推出
     帧外、要滚动才找得到，ww 判不合格）；桌面原地渲染、顺序不变。
     金币条 + 选中行是状态，留在竖栏 panel-foot。 */
  const actionBlock = (
    <>
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
          {/* R2-14：算式从金币条下挪到卡片下方、与按钮同一行，不压卡片 */}
          {sel && (
            <span className="cb-math cb-math--inrow" aria-hidden="true">
              {fmt(strings.coinbar.math, {
                a: me.coins,
                b: sel.price,
                c: Math.max(0, me.coins - sel.price),
              })}
            </span>
          )}
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

        {/* R2-10：主次定死——Buy 是橙色主按钮（篮子区 armed 态），
            Done 永远是藏青次按钮（data-primary 仅留键盘主动作语义） */}
        <Button
          variant="secondary"
          className="btn--navy"
          keyHint={String(kEnd)}
          data-testid={`action-${kEnd}`}
          data-primary={endPrimary ? 'true' : undefined}
          data-key={kEnd}
          disabled={pending.pendingLabel !== null}
          onClick={() => send({ type: 'END_TURN' })}
        >
          {strings.panel.endTurn}
        </Button>
    </>
  );

  return (
    <div className="panel-body">
      {/* R2-1 + R2 验收修复：手机横屏卡扇 + 主操作走 portal 浮到棋盘区
          （状态/选中/拖拽逻辑仍在本组件一处，拖拽坐标命中不受影响；
          投放区按钮与卡扇同层，孩子不用滚动竖栏找主按钮） */}
      {handFloatEl
        ? createPortal(
            <div className="phone-float-stack">
              {stallFanBlock}
              {/* R6 N3：≤700 时栏内选中块随弹窗让位隐藏，栈内这份
                  专行接棒（Picked 行 + 算式；CSS 只在 ≤700 显示，
                  701+ 栏内 foot 的选中块/算式行是正主） */}
              {sel && (
                <div className="panel-selected panel-selected--float">
                  <span className="panel-selected-line">
                    {strings.panel.selectedMark}
                    <CardIcon icon={sel.icon} /> {sel.name} ({sel.price}{' '}
                    {coinWord(sel.price)})
                  </span>
                  <span className="cb-math cb-math--float" aria-hidden="true">
                    {fmt(strings.coinbar.math, {
                      a: me.coins,
                      b: sel.price,
                      c: Math.max(0, me.coins - sel.price),
                    })}
                  </span>
                </div>
              )}
              {actionBlock}
            </div>,
            handFloatEl,
          )
        : stallFanBlock}

      <div className="panel-foot">
        {/* S-4：桌面档说明行（stallGuide）放 foot 首行——与金币条同流、
            永不相叠（手机横屏不走这里，说明行在浮层扇下方）。
            「还能买 N 张」仍只在浮签角标 ×N 一处 */}
        {!handFloatEl && stallGuide}
        <div className="panel-foot-row">
          {/* 金币条：菜谱还差/车费/自由花三段；选中卡的价从自由花端点亮。
              R2-14：算式不在条下渲染——改放投放区同一行（见 drop-row） */}
          <CoinBar
            coins={me.coins}
            missingCost={w.missingCost}
            busDebt={w.busDebt}
            spend={sel ? sel.price : 0}
            hideMath
          />
        </div>
        {sel && (
          <p className="panel-text panel-selected" aria-live="polite">
            <span className="panel-selected-line">
              {strings.panel.selectedMark}
              <CardIcon icon={sel.icon} /> {sel.name}{' '}
              {/* R6 S2：价格括注独立成片——手机竖栏只有 ~166px 内容宽，
                  整行必折成残片；手机档藏掉这一片（价在卡面价丸/买钮/
                  算式三处都在），只留「Picked: 名」短句一行 */}
              <span className="sel-price-part">
                ({sel.price} {coinWord(sel.price)})
              </span>
            </span>
            <span className="panel-selected-line">
              {me.coins >= sel.price
                ? fmt(strings.panel.afterBuy, { n: me.coins - sel.price })
                : strings.panel.noCoins}
            </span>
          </p>
        )}
        {/* R6 N6：手机档算式改在此独占一行（行内式在手机隐藏，
            CSS 见 phone.css .cb-math--foot）；桌面不渲染这一份 */}
        {sel && (
          <span className="cb-math cb-math--foot" aria-hidden="true">
            {fmt(strings.coinbar.math, {
              a: me.coins,
              b: sel.price,
              c: Math.max(0, me.coins - sel.price),
            })}
          </span>
        )}

        {/* 桌面：主操作原地接在状态行之后（与旧版顺序一致）；
            手机横屏：已随卡扇 portal 到浮层，这里不再重复渲染 */}
        {!handFloatEl && actionBlock}
        <p className="panel-keyhelp panel-keyhelp--kbd">{strings.panel.keyHelp}</p>
      </div>
    </div>
  );
}
