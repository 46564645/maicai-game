/**
 * Hand.tsx —— React Bits「BounceCards」改造（MIT + Commons Clause，署名见
 * THIRD_PARTY_NOTICES.md）。原版是 GSAP 的弹簧散开图片扇；这里换成纯 CSS：
 * 每张卡按扇形变量（--fan-deg / --fan-arc-drop）旋转+下沉，新卡入场
 * 弹入（scale 0.6→1 + 轻回弹，逐卡错 40ms）。
 *
 * 交互（R10_DESIGN §4.2）：
 *  - hover/focus-within：该卡「立直 + 上浮 + 放大 6%」，左右邻卡让位
 *    （hand-push 类由 CSS 兄弟选择器 :has(+ .hand-item:hover) 处理）
 *  - 键盘：每张卡面本身是原生 <button>，Tab 直达；扇形层不抢焦点
 *  - reduced-motion：入场弹入/让位位移全部退化（全局 reduce 规则兜底）
 *
 * 卡面是任意 ReactNode（不假设图片）——市场里每张是 CardView，
 * 底栏里是 RecipeCard / 留菜夹卡。`.hand--free` 允许各卡等宽自适应；
 * 默认固定卡宽 --card-w 并让相邻卡负间距叠出「露出带」（--fan-expose）。
 */
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export interface HandItem {
  key: string;
  node: ReactNode;
  /** 透传到该手牌位（如 'hand-item--sel'） */
  className?: string;
  /** 该卡宽度（默认 --card-w；free 档忽略） */
  width?: number;
}

export interface HandProps {
  items: HandItem[];
  /** 'fan'（默认，固定宽叠带）| 'free'（宽度自适应、不重叠） */
  layout?: 'fan' | 'free';
  /** 整手压暗（非本玩家回合，§4.1 idle 档） */
  dimmed?: boolean;
  /** 入场弹入（默认开；重排不重演——只对新增 key 播一次） */
  bounceIn?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Hand({
  items,
  layout = 'fan',
  dimmed = false,
  bounceIn = true,
  className = '',
  ariaLabel,
}: HandProps) {
  const n = items.length;
  const center = (n - 1) / 2;
  // 两侧递增转角上限 --fan-deg；n=1 无转角
  const step = n > 1 ? 10 / Math.max(center, 1) : 0;
  // 入场弹入只对新 key 播：已见过的 key 记入 ref，不再重播
  const seenRef = useRef<Set<string>>(new Set());
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!bounceIn) return;
    const fresh = items.filter((it) => !seenRef.current.has(it.key)).map((it) => it.key);
    if (fresh.length) {
      setNewKeys(new Set(fresh));
      const t = window.setTimeout(() => {
        for (const k of fresh) seenRef.current.add(k);
        setNewKeys(new Set());
      }, 500 + fresh.length * 40);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [items, bounceIn]);

  // R10C：≤3 张的扇不再叠带（16px 间隙，卡名横幅整幅可读）；
  // >3 张才进入叠带拥挤态（横幅被盖部分收掉，认卡靠 .hand-tag 大浮签）
  const fanCls =
    layout === 'fan' ? (n > 3 ? ' hand--crowded' : ' hand--spread') : '';
  const cls =
    `hand hand--${layout}${fanCls}${dimmed ? ' hand--dim' : ''}` +
    (className ? ` ${className}` : '');
  return (
    <div className={cls} role="group" aria-label={ariaLabel}>
      {items.map((it, i) => {
        const off = i - center;
        const rot = off * step; // deg
        const drop = Math.abs(off) * Math.abs(off) * 4; // 弧线下沉 px
        const itemCls =
          `hand-item${newKeys.has(it.key) ? ' hand-item--in' : ''}` +
          (it.className ? ` ${it.className}` : '');
        return (
          <div
            key={it.key}
            className={itemCls}
            style={
              {
                '--fan-rot': `${rot.toFixed(2)}deg`,
                '--fan-drop': `${drop.toFixed(1)}px`,
                '--fan-i': i,
              } as CSSProperties
            }
          >
            {it.node}
          </div>
        );
      })}
    </div>
  );
}
