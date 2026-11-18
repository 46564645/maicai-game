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
 *  - R10D 触屏长按检视（interaction #4）：touch 按住 300ms → 卡放大 1.15
 *    + 名签浮出（复用 .hand-tag 大浮签）+ 卡面已配 speakText 时朗读；
 *    松手全部还原——不选中、不打命令、不碰后悔窗口。按住挪过 14px
 *    =「要拖了」检视立即让位给 useDragPlay；松手是 tap 则照常走点按
 *    （Slice C tap-rescue 不回归；检视后吞掉松手那一下 click，防误选）。
 *  - 名签/徽标移交扇层：item.name → .hand-tag 大浮签（旧版各面板自渲
 *    同款，现在由这里统一出）；item.badge → 角上「×2」同卡计数徽标。
 *
 * 卡面是任意 ReactNode（不假设图片）——市场里每张是 CardView，
 * 底栏里是 RecipeCard / 留菜夹卡。`.hand--free` 允许各卡等宽自适应；
 * 默认固定卡宽 --card-w 并让相邻卡负间距叠出「露出带」（--fan-expose）。
 */
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSpeech } from '../../ui/useSpeech';
import { LONG_PRESS_MS, inspectCancelled } from './pressInspect';

export interface HandItem {
  key: string;
  node: ReactNode;
  /** 透传到该手牌位（如 'hand-item--sel'） */
  className?: string;
  /** 该卡宽度（默认 --card-w；free 档忽略） */
  width?: number;
  /** R10D：选中/检视时浮在卡上方的 28px 大浮签文本（旧各面板自渲，归口这里） */
  name?: string;
  /** R10D：同卡相邻 >1 时的角上计数徽标（「×2」） */
  badge?: string;
  /** R10D：长按检视顺带朗读的文本（该卡已有朗读接线才给） */
  speakText?: string;
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

/** 一次触屏按压的状态（检视计时器 + 位移判拖共用） */
interface PressState {
  key: string;
  pointerId: number;
  x: number;
  y: number;
  timer: number;
  /** true = 计时器已响、检视已开；松手/拖走要收掉并吞 click */
  inspected: boolean;
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

  /* —— R10D 触屏长按检视 —— */
  const { speak } = useSpeech();
  const [inspectKey, setInspectKey] = useState<string | null>(null);
  const pressRef = useRef<PressState | null>(null);
  // 检视后松手那一下 click 要吞掉（不选中、不打出）
  const swallowClickRef = useRef(false);

  const cancelPressTimer = () => {
    const p = pressRef.current;
    if (p) window.clearTimeout(p.timer);
  };

  const onItemDown = (it: HandItem) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' || !e.isPrimary || e.button !== 0) return;
    cancelPressTimer();
    const st: PressState = {
      key: it.key,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      inspected: false,
      timer: window.setTimeout(() => {
        // 300ms 按住没挪 → 检视：卡放大 + 名签浮出 + 配了朗读就朗读
        if (pressRef.current !== st || st.inspected) return;
        st.inspected = true;
        swallowClickRef.current = true; // 检视后的松手 click 一律吞
        setInspectKey(it.key);
        if (it.speakText) speak(it.speakText);
      }, LONG_PRESS_MS),
    };
    pressRef.current = st;
  };

  const onItemMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = pressRef.current;
    if (!st || e.pointerId !== st.pointerId) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!inspectCancelled(dx, dy)) return;
    // 「要拖了」：检视（含计时器）立即让位给 useDragPlay
    cancelPressTimer();
    if (st.inspected) setInspectKey(null);
    st.inspected = false;
    swallowClickRef.current = false;
    pressRef.current = null;
  };

  const endPress = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = pressRef.current;
    if (!st || e.pointerId !== st.pointerId) return;
    cancelPressTimer();
    if (st.inspected) setInspectKey(null);
    pressRef.current = null;
  };

  const onItemClickCapture = (e: SyntheticEvent<HTMLDivElement>) => {
    if (swallowClickRef.current) {
      swallowClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

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
          `${inspectKey === it.key ? ' hand-item--inspect' : ''}` +
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
            onPointerDown={onItemDown(it)}
            onPointerMove={onItemMove}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onClickCapture={onItemClickCapture}
          >
            {it.badge && (
              <span className="hand-badge" aria-hidden="true">
                {it.badge}
              </span>
            )}
            {it.node}
            {/* R10D：大浮签归口扇层——选中/聚焦/hover 照旧显示，
                长按检视（.hand-item--inspect）同样浮出 */}
            {it.name && (
              <span className="hand-tag" aria-hidden="true">
                {it.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
