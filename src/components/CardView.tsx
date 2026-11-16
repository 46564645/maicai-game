/**
 * CardView.tsx —— 通用卡面（icon + 名称 + 价格 + 标签）。
 * 可点时渲染为原生 <button>（角色卡、市场卡、图卡共用）；纯展示时渲染 div。
 */
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { coinWord } from '../data/strings';
import { CardIcon } from './CardIcon';
import { KeyHint } from './KeyHint';

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
  onClick?: () => void;
  /** 键盘焦点落入即回调（市场「←→ 选卡」焦点=选中用） */
  onFocus?: () => void;
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
  const cls = ['card-view', props.selected ? 'card-view--selected' : '']
    .filter(Boolean)
    .join(' ');
  const body = (
    <>
      {props.mark && (
        <span className="card-view-mark" aria-hidden="true">
          ✓
        </span>
      )}
      {props.keyHint !== undefined && <KeyHint value={props.keyHint} />}
      <span className="card-view-icon" aria-hidden="true">
        <CardIcon icon={props.icon} />
      </span>
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
      {props.price !== undefined && (
        <span className="card-view-price">
          {props.price} {coinWord(props.price)}
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
      {props.children}
    </>
  );
  if (props.onClick) {
    return (
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
  }
  return <div className={cls}>{body}</div>;
}
