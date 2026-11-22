/**
 * TextType.tsx —— React Bits「Text Type」自包含改写（MIT + Commons
 * Clause，署名见 THIRD_PARTY_NOTICES.md）。原版用 GSAP/SplitType 做
 * 逐字打字机；这里零依赖复刻同一阅读节奏：回复按字定速显出（默认
 * 24ms/字 ≈ 40 字/秒），打字中点小竖线光标；孩子等不及可**点一下
 * 立即看全句**（tap-to-complete），键盘 Enter/Space 同效（打字中
 * 该元素本身是 button 语义）。
 *
 * 动效口径：只有 setInterval 逐字推进，无 @keyframes、无 motion；
 * reduced-motion → 全句直接给出（与全站口径一致）。
 * 无障碍：打字中可见文字 aria-hidden、整句放 aria-label（读屏一次
 * 读全句，不逐字念）；打完回归普通文本节点。外层 aria-live 区域
 * （如聊天气泡）也只在落定瞬间被通告一次。
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export interface TextTypeProps {
  text: string;
  /** ms/字（默认 24 ≈ 每秒 40 字） */
  msPerChar?: number;
  /** 打完回调（可选） */
  onDone?: () => void;
  className?: string;
}

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function TextType({ text, msPerChar = 24, onDone, className = '' }: TextTypeProps) {
  const [n, setN] = useState(() => (reduced() ? text.length : 0));
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduced()) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(t);
    }, Math.max(8, msPerChar));
    return () => window.clearInterval(t);
  }, [text, msPerChar]);

  const typing = n < text.length;
  useEffect(() => {
    if (!typing) doneRef.current?.();
  }, [typing, text]);

  const complete = () => setN(text.length);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      complete();
    }
  };

  if (!typing) {
    return <span className={`rb-tt-done${className ? ` ${className}` : ''}`}>{text}</span>;
  }
  return (
    <span
      className={`rb-tt-typing${className ? ` ${className}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={text}
      onClick={complete}
      onKeyDown={onKey}
    >
      <span aria-hidden="true">
        {text.slice(0, n)}
        <i className="rb-tt-caret" />
      </span>
    </span>
  );
}
