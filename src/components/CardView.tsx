/**
 * CardView.tsx —— 通用卡面。版式（T-1 统一卡面，Thong 2026-11-19 定稿，
 * 取代上一版白底板模板）：全站一张卡——统一尺寸（--card-w × --card-h，
 * 104×152）、统一解剖，无逐屏尺寸（个别物理放不下的窄栏用整体等比
 * zoom，见 phone.css，属已申报的例外）。卡面底色 = 全站统一暖白
 * （Thong 2026-11-20 定稿：纯暖白底卡 + 透明 PNG 直贴，cardArt.ts
 * 的 CARD_BASE_BG），透明插画整幅 contain 直接放在卡面上：无框、
 * 无边框盒、无白板、无裁剪；图占上方约 2/3，全部文字
 * （卡名/价格金币/类别/标签/✓/键位徽标）排在下方约 1/3 的文字区
 * （.card-view-text），图上零文字零角标。长名只在空格处折行
 * （R6 口径：连字符断词关闭，不再插软连字符）；放不下时字号逐级
 * 下调（地板 14px），最多三行，不省略、不裁剪（拟合逻辑见
 * useNameFit）。人物卡（ProfileCard）不在此列。
 *
 * 美术区：cards/cardArt.ts 里登过 cardId → 渲染插画 <img>；没登 →
 * 回退原有 emoji/CardIcon（底色用默认卡面色）。
 *
 * 可点时渲染为原生 <button>（角色卡、市场卡、图卡共用）；纯展示时渲染 div。
 * 旧类名保留（.card-view/-icon/-name/-tag/-mark + --selected）；
 * .card-view-board 白底板废止，文字区为 .card-view-text + 元行
 * .card-view-meta。
 */
import { Fragment, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { strings } from '../data/strings';
import { useSpeech } from '../ui/useSpeech';
import { CardIcon } from './CardIcon';
import { KeyHint } from './KeyHint';
import { cardArtFor, cardArtInsetFor, cardBgFor } from './cards/cardArt';
import { MetaIcon, type MetaIconKind } from './cards/MetaIcon';

export interface CardViewProps {
  icon: string;
  name: string;
  price?: number;
  tag?: string;
  /** 卡角小 ✓ 标记（ww M4.5.7a：菜谱上的食材，长标签会溢出窄卡）。
   *  R6 决策 2：渲染成 MetaIcon 'list'（绿圆白勾），文字「On my list」下卡面 */
  mark?: boolean;
  /** R6 决策 2：类别记号（'food' 胡萝卜 / 'fun' 星星）——替代原
   *  「Food / Fun stuff」文字标签，与价格丸同排渲染，不另起一行 */
  tagIcon?: MetaIconKind;
  /** R6（ww Part 1.4）：暂时拿不到的卡挂锁记号（≥20px）——卡不变灰、
   *  不压透明度，只是不抬升；取代旧 pglow--dim 灰化 */
  locked?: boolean;
  keyHint?: string;
  selected?: boolean;
  disabled?: boolean;
  /** 渲染 data-primary（Enter/空格 主动作），同时加粗描边 */
  primary?: boolean;
  /** R10：卡牌 id——cardArt.ts 有登记则在美术区显示插画 */
  cardId?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** 键盘焦点落入即回调（市场「←→ 选卡」焦点=选中用） */
  onFocus?: () => void;
  /** 提供且朗读可用时，卡右上角追加 🔊 朗读钮（不嵌套进卡按钮） */
  speakText?: string;
  testid?: string;
  dataKey?: number;
  ariaLabel?: string;
  children?: ReactNode;
}

/** 卡名字号地板（R6 Prof 口径）：逐级下调只到 14px，不再往下 */
const NAME_MIN_PX = 14;
/** 卡名最多三行（R6 Prof 口径）：空格折行 + 缩字号后仍超三行才算放不下 */
const NAME_MAX_LINES = 3;

/**
 * 卡名拟合（R6 item 1，取代 M4.5.9b 的 &shy; 音节断词）：卡名原文
 * 渲染、只在空格处折行（CSS keep-all + hyphens:none）；挂载后实测
 * 名元素——横向溢出（单个词宽于栏宽）或行数超过三行时，把字号
 * 从 CSS 档位逐级下调 1px（地板 14px）直至放下。直接写元素 inline
 * 样式（名元素无 React style prop，不会被重渲染覆盖）；卡根尺寸
 * 变化（视口/缩放档切换）时经 ResizeObserver 重测。jsdom 等无
 * 布局环境下读不到字号则整体跳过（单测不受影响）。
 */
function useNameFit(nameRef: React.RefObject<HTMLSpanElement | null>, name: string) {
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      const base = parseFloat(window.getComputedStyle(el).fontSize);
      if (!Number.isFinite(base) || base <= 0) return;
      const fits = () => {
        const cs = window.getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const lh = parseFloat(cs.lineHeight);
        const lineH = Number.isFinite(lh) && lh > 0 ? lh : size * 1.2;
        const lines = Math.max(1, Math.round(el.scrollHeight / lineH));
        return el.scrollWidth <= el.clientWidth + 1 && lines <= NAME_MAX_LINES;
      };
      let size = base;
      let guard = 0;
      while (!fits() && size > NAME_MIN_PX && guard++ < 8) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
      if (size >= base) el.style.fontSize = '';
    };
    fit();
    const host = el.closest('.card-view') ?? el.parentElement;
    if (typeof ResizeObserver === 'undefined' || !host) return;
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    return () => ro.disconnect();
  }, [nameRef, name]);
}

export function CardView(props: CardViewProps) {
  const { supported: speakSupported, speak } = useSpeech();
  const nameRef = useRef<HTMLSpanElement>(null);
  useNameFit(nameRef, props.name);
  const cls = ['card-view', props.selected ? 'card-view--selected' : '']
    .filter(Boolean)
    .join(' ');
  const art = props.cardId ? cardArtFor(props.cardId) : undefined;
  // 卡面底色：全站统一暖白（cardArt.ts 的 CARD_BASE_BG，Thong
  // 2026-11-20 定稿）——透明 PNG 直贴底卡，无框无白板。无图卡不设，
  // 走 CSS 默认卡面色（--card-bg-default，同值）。
  const bg = props.cardId ? cardBgFor(props.cardId) : undefined;
  const rootStyle = bg
    ? ({ '--card-bg': bg } as CSSProperties)
    : undefined;
  // 无价格卡 → 文字区类别小签取 tag 首段（「菜谱」/「想要的」）。
  // 只收短词（≤6 字）：整句型 tag（如搭档站分摊说明）不是类别，
  // 塞进小签会膨胀成大气球盖住整卡（全屏排查实测）——
  // 长句只走元行的标签文本，小签不渲染
  const kindHead = props.tag?.split('·')[0]?.trim();
  const kindChip =
    props.price === undefined && kindHead && kindHead.length <= 6
      ? kindHead
      : undefined;
  const hasMeta =
    props.keyHint !== undefined ||
    props.price !== undefined ||
    kindChip !== undefined ||
    props.tag !== undefined ||
    props.tagIcon !== undefined ||
    props.locked === true ||
    props.mark === true;
  const body = (
    <>
      <span className="card-view-art" aria-hidden="true">
        {art ? (
          <img
            className="card-view-art-img"
            src={art}
            alt=""
            draggable={false}
            style={
              props.cardId && cardArtInsetFor(props.cardId)
                ? { transform: `scale(${cardArtInsetFor(props.cardId)})` }
                : undefined
            }
          />
        ) : (
          <span className="card-view-icon">
            <CardIcon icon={props.icon} />
          </span>
        )}
      </span>
      {/* T-1 文字区（卡面下方约 1/3）：全部文字在此——卡名、价格
          金币丸、类别签、标签、✓、键位徽标；图上零文字零角标。
          底色与卡面同色（继承 --card-bg），与美术区无缝衔接 */}
      <span className="card-view-text">
        <span className="card-view-banner">
          {/* R6：卡名原文渲染——只在空格处折行，绝不插软连字符断词；
              放不下由 useNameFit 逐级缩字号（地板 14px、最多三行） */}
          <span className="card-view-name" ref={nameRef}>
            {props.name}
          </span>
        </span>
        {hasMeta && (
          <span className="card-view-meta">
            {props.keyHint !== undefined && <KeyHint value={props.keyHint} />}
            {props.price !== undefined && (
              <span className="card-view-gem" aria-hidden="true">
                {props.price}
              </span>
            )}
            {props.price === undefined && kindChip && (
              <span className="card-view-kind" aria-hidden="true">
                {kindChip}
              </span>
            )}
            {props.tagIcon && (
              <span className="card-view-tagicon">
                <MetaIcon kind={props.tagIcon} />
              </span>
            )}
            {props.locked && (
              <span
                className="card-view-lock"
                role="img"
                aria-label={strings.panel.lockedLabel}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <rect x="4.8" y="10.2" width="14.4" height="10" rx="2.4" fill="currentColor" />
                  <circle cx="12" cy="15" r="1.9" fill="#fff" opacity="0.92" />
                </svg>
              </span>
            )}
            {props.tag && (
              <span className="card-view-tag">
                {props.tag
                  .split('·')
                  .map((p) => p.trim())
                  .map((part, i, arr) => (
                    <Fragment key={i}>
                      {i > 0 && ' '}
                      <span className="card-view-tag-part">
                        {part}
                        {i < arr.length - 1 && ' ·'}
                      </span>
                    </Fragment>
                  ))}
              </span>
            )}
            {props.mark && (
              <span className="card-view-mark">
                <MetaIcon kind="list" />
              </span>
            )}
          </span>
        )}
      </span>
      {props.children}
    </>
  );
  if (props.onClick) {
    const btn = (
      <button
        type="button"
        className={cls}
        style={rootStyle}
        onClick={props.onClick}
        onFocus={props.onFocus}
        disabled={props.disabled}
        aria-pressed={props.selected}
        aria-label={props.ariaLabel}
        data-testid={props.testid}
        data-key={props.dataKey}
        data-primary={props.primary ? 'true' : undefined}
      >
        {body}
      </button>
    );
    if (!props.speakText || !speakSupported) return btn;
    return (
      <span className="card-view-speak">
        {btn}
        <button
          type="button"
          className="btn-speak card-view-speak-btn"
          aria-label={strings.speech.speak}
          onClick={(e) => {
            e.stopPropagation();
            speak(props.speakText!);
          }}
        >
          🔊
        </button>
      </span>
    );
  }
  return (
    <div className={cls} style={rootStyle}>
      {body}
    </div>
  );
}
