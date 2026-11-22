/**
 * Button.tsx —— 统一大按钮（主按钮 ≥56px / 次按钮白底描边）。
 * 可选 keyHint 数字键徽标与 icon；speakText 提供且朗读可用时，右侧
 * 追加一个 🔊 朗读钮（不嵌套进主按钮）。全部用原生 <button>。
 */
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { strings } from '../data/strings';
import { useSpeech } from '../ui/useSpeech';
import { KeyHint } from './KeyHint';
import { PressButton } from './bits/PressButton';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  keyHint?: string;
  icon?: ReactNode;
  /** 提供且 speechSynthesis 可用时，按钮右侧追加 🔊 朗读钮 */
  speakText?: string;
  /** R10：拖拽投放区命中要拿按钮本体的 DOM 节点（forwardRef 等价物） */
  innerRef?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  keyHint,
  icon,
  speakText,
  className,
  children,
  innerRef,
  ...rest
}: ButtonProps) {
  const { supported, speak } = useSpeech();
  const cls = ['btn', `btn--${variant}`, className ?? ''].filter(Boolean).join(' ');
  const btn = (
    <PressButton className={cls} ref={innerRef} {...rest}>
      {keyHint !== undefined && <KeyHint value={keyHint} />}
      {icon}
      {children}
    </PressButton>
  );
  if (!speakText || !supported) return btn;
  return (
    <span className="btn-speak-wrap">
      {btn}
      <PressButton
        className="btn-speak"
        aria-label={strings.speech.speak}
        onClick={(e) => {
          e.stopPropagation();
          speak(speakText);
        }}
      >
        🔊
      </PressButton>
    </span>
  );
}
