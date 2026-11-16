/**
 * Button.tsx —— 统一大按钮（主按钮 ≥56px / 次按钮白底描边）。
 * 可选 keyHint 数字键徽标与 icon；speakText 提供且朗读可用时，右侧
 * 追加一个 🔊 朗读钮（不嵌套进主按钮）。全部用原生 <button>。
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { strings } from '../data/strings';
import { useSpeech } from '../ui/useSpeech';
import { KeyHint } from './KeyHint';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  keyHint?: string;
  icon?: ReactNode;
  /** 提供且 speechSynthesis 可用时，按钮右侧追加 🔊 朗读钮 */
  speakText?: string;
}

export function Button({
  variant = 'secondary',
  keyHint,
  icon,
  speakText,
  className,
  children,
  ...rest
}: ButtonProps) {
  const { supported, speak } = useSpeech();
  const cls = ['btn', `btn--${variant}`, className ?? ''].filter(Boolean).join(' ');
  const btn = (
    <button type="button" className={cls} {...rest}>
      {keyHint !== undefined && <KeyHint value={keyHint} />}
      {icon}
      {children}
    </button>
  );
  if (!speakText || !supported) return btn;
  return (
    <span className="btn-speak-wrap">
      {btn}
      <button
        type="button"
        className="btn-speak"
        aria-label={strings.speech.speak}
        onClick={(e) => {
          e.stopPropagation();
          speak(speakText);
        }}
      >
        🔊
      </button>
    </span>
  );
}
