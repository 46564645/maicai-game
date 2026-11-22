/**
 * TextType.tsx —— React Bits「Text Type」动效改写版（David Haz，
 * MIT + Commons Clause，已登记 THIRD_PARTY_NOTICES.md）。
 * 原组件用 gsap 时间轴（本项目不采用 gsap）；此处用 rAF 节流 +
 * visibility 逐字显隐实现同样的「定速打字」：字符原位渲染、全程
 * 占位（visibility 保留布局，短句打字不抖行高）；点一下立即补全。
 * 短行专用（SpeechBubble 提议气泡文案）。
 * prefers-reduced-motion：整句直接呈现。
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export interface TextTypeHandle {
  /** 立即补全（点按路径） */
  complete: () => void;
  done: () => boolean;
}

export interface TextTypeProps {
  text: string;
  className?: string;
  /** 每字间隔（ms），默认 48；总量自动封顶 ~2.4s，长句自动加快 */
  speed?: number;
  /** 打完回调（只触发一次） */
  onDone?: () => void;
  /** 前置内容（说话人等行内前缀，不参与打字） */
  prefix?: ReactNode;
}

/** 全句总时长上限（ms）：短句 48ms/字，超长时自动匀到上限内 */
const TOTAL_CAP_MS = 2400;

export const TextType = forwardRef<TextTypeHandle, TextTypeProps>(
  function TextType({ text, className, speed = 48, onDone, prefix }, ref) {
    const reduce = useReducedMotion();
    const chars = useMemo(() => Array.from(text), [text]);
    const [shown, setShown] = useState(reduce ? chars.length : 0);
    const doneRef = useRef(reduce || chars.length === 0);
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;
    const rafRef = useRef(0);

    /* text 变（新气泡）→ 重打 */
    useEffect(() => {
      setShown(reduce ? chars.length : 0);
      doneRef.current = reduce || chars.length === 0;
    }, [text, chars.length, reduce]);

    useEffect(() => {
      if (doneRef.current) return undefined;
      const stepMs = Math.min(speed, Math.max(TOTAL_CAP_MS / Math.max(chars.length, 1), 16));
      let last = performance.now();
      let acc = 0;
      let n = 0;
      const tick = (t: number) => {
        acc += t - last;
        last = t;
        while (acc >= stepMs && n < chars.length) {
          acc -= stepMs;
          n += 1;
        }
        setShown(n);
        if (n >= chars.length) {
          doneRef.current = true;
          onDoneRef.current?.();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
    }, [text, chars.length, speed]);

    useImperativeHandle(
      ref,
      () => ({
        complete: () => {
          if (doneRef.current) return;
          doneRef.current = true;
          cancelAnimationFrame(rafRef.current);
          setShown(chars.length);
          onDoneRef.current?.();
        },
        done: () => doneRef.current,
      }),
      [chars.length],
    );

    const isDone = shown >= chars.length;
    return (
      <span className={`text-type${isDone ? ' text-type--done' : ''}${className ? ` ${className}` : ''}`}>
        {prefix}
        {/* 可见层逐字显隐（占位不折行）；读屏拿整句 */}
        <span aria-hidden="true">
          {chars.map((c, i) => (
            <span
              key={i}
              className="text-type__ch"
              style={{ visibility: i < shown ? 'visible' : 'hidden' }}
            >
              {c}
            </span>
          ))}
        </span>
        <span className="sr-only">{text}</span>
      </span>
    );
  },
);
