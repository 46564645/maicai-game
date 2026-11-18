/**
 * CardView.tsx —— 通用卡面，R10 §3.1 卡面解剖：卡框 → 美术区（约 55%）→
 * 名称横幅；价格渲染成左上角「法力宝石」（橙渐变圆 + 白字 + 内嵌小金币），
 * 无价卡改在角上放类别小标签（tag 首个分段）。
 *
 * 美术区：cards/cardArt.ts 里登过 cardId → 渲染插画 <img>；没登 →
 * 回退原有 emoji/CardIcon 圆形衬底（13 张食材等 PM 后续补图）。
 * cardId 是 R10 新增的可选 prop——原有调用方不传则行为与旧版一致。
 *
 * 可点时渲染为原生 <button>（角色卡、市场卡、图卡共用）；纯展示时渲染 div。
 * 旧类名全保留（.card-view/-icon/-name/-tag/-mark + --selected），
 * phone.css / hud.css 的窄栏、行式覆写不破。
 */
import { Fragment } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { strings } from '../data/strings';
import { useSpeech } from '../ui/useSpeech';
import { CardIcon } from './CardIcon';
import { KeyHint } from './KeyHint';
import { cardArtFor } from './cards/cardArt';

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
  // 无价格卡 → 角上类别小标签取 tag 首段（「菜谱」/「想要的」）
  const kindChip =
    props.price === undefined && props.tag
      ? props.tag.split('·')[0]?.trim()
      : undefined;
  const body = (
    <>
      {props.mark && (
        <span className="card-view-mark" aria-hidden="true">
          ✓
        </span>
      )}
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
      <span className="card-view-art" aria-hidden="true">
        {art ? (
          <img className="card-view-art-img" src={art} alt="" draggable={false} />
        ) : (
          <span className="card-view-icon">
            <CardIcon icon={props.icon} />
          </span>
        )}
      </span>
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
      {props.children}
    </>
  );
  if (props.onClick) {
    const btn = (
      <button
        type="button"
        className={cls}
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
  return <div className={cls}>{body}</div>;
}
