/**
 * CardView.tsx —— 通用卡面。版式（T-1 统一卡面，Thong 2026-11-19 定稿，
 * 取代上一版白底板模板）：全站一张卡——统一尺寸（--card-w × --card-h，
 * 104×152）、统一解剖，无逐屏尺寸（个别物理放不下的窄栏用整体等比
 * zoom，见 phone.css，属已申报的例外）。卡面底色 = 插画自身底色
 * （cardArt.ts 的 cardBgFor 采样表），原图整幅 contain 直接放在卡面
 * 上：无框、无边框盒、无白板、无裁剪；图占上方约 2/3，全部文字
 * （卡名/价格金币/类别/标签/✓/键位徽标）排在下方约 1/3 的文字区
 * （.card-view-text），图上零文字零角标。长名在文字区内按音节软
 * 连字符折两行，不缩字、不省略。人物卡（ProfileCard）不在此列。
 *
 * 美术区：cards/cardArt.ts 里登过 cardId → 渲染插画 <img>；没登 →
 * 回退原有 emoji/CardIcon（底色用默认卡面色）。
 *
 * 可点时渲染为原生 <button>（角色卡、市场卡、图卡共用）；纯展示时渲染 div。
 * 旧类名保留（.card-view/-icon/-name/-tag/-mark + --selected）；
 * .card-view-board 白底板废止，文字区为 .card-view-text + 元行
 * .card-view-meta。
 */
import { Fragment } from 'react';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { strings } from '../data/strings';
import { useSpeech } from '../ui/useSpeech';
import { CardIcon } from './CardIcon';
import { KeyHint } from './KeyHint';
import { cardArtFor, cardBgFor } from './cards/cardArt';

export interface CardViewProps {
  icon: string;
  name: string;
  /** cards.json 音节断点（字符索引）：窄栏放不下时在断点插 &shy; 折行 */
  nameBreak?: number;
  price?: number;
  tag?: string;
  /** 卡角小 ✓ 标记（ww M4.5.7a：菜谱上的食材，长标签会溢出窄卡） */
  mark?: boolean;
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

/**
 * 长菜名在词尾音节处插软连字符 &shy;（ww M4.5.9b）：窄栏放不下时
 * 按音节折成两行（Mush-room、Cucum-ber、Marsh-mallow），放得下时
 * 完全不可见。只作用于卡面名；aria-label、流水、朗读仍用原名。
 * 断点是「可断点」而非「必断点」，位置略偏也只发生在装不下时。
 */
function nameWithBreaks(name: string): string {
  return name.replace(/[A-Za-z]{6,}/g, (w) => {
    const marks =
      w.length >= 10 ? [w.length - 7, w.length - 4] : [w.length >= 8 ? w.length - 4 : w.length - 3];
    let out = '';
    let prev = 0;
    for (const m of marks) {
      out += w.slice(prev, m) + '\u00AD';
      prev = m;
    }
    return out + w.slice(prev);
  });
}

export function CardView(props: CardViewProps) {
  const { supported: speakSupported, speak } = useSpeech();
  const cls = ['card-view', props.selected ? 'card-view--selected' : '']
    .filter(Boolean)
    .join(' ');
  const art = props.cardId ? cardArtFor(props.cardId) : undefined;
  // T-1：卡面底色取插画自身底色（采样表在 cardArt.ts）——图与卡底
  // 同色融合，无框无白板。无图卡不设，走 CSS 默认卡面色。
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
    props.mark === true;
  const body = (
    <>
      <span className="card-view-art" aria-hidden="true">
        {art ? (
          <img className="card-view-art-img" src={art} alt="" draggable={false} />
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
          <span className="card-view-name">
            {/* nameBreak：cards.json 标的音节断点，放 &shy; 软连字符——
                放得下时不可见，放不下时按音节折两行（Mush-room、
                Marsh-mallow），不会像 break-word 那样断出「Carro t」 */}
            {props.nameBreak !== undefined &&
            props.nameBreak > 0 &&
            props.nameBreak < props.name.length ? (
              <>
                {props.name.slice(0, props.nameBreak)}
                {'\u00AD'}
                {props.name.slice(props.nameBreak)}
              </>
            ) : (
              nameWithBreaks(props.name)
            )}
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
              <span className="card-view-mark" aria-hidden="true">
                ✓
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
