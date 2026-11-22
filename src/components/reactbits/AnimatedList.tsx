/**
 * AnimatedList.tsx —— React Bits「Animated List」裁剪移植（MIT +
 * Commons Clause，署名见 THIRD_PARTY_NOTICES.md）。原版是带键盘导航/
 * 悬停选中/滚动渐隐/主题框体的完整选择列表；这里裁成「入场弹簧 +
 * 可选滑行高亮」两点：
 *   · 入场：items 按 stagger 错峰从下方弹入（原版 pop 姿态
 *     translate3d(0,12px,0) scale(0.8)，同款 SPRING linear() 缓动）；
 *     后插入的 item（如反思页逐人追加）只播新 key。
 *   · 滑行高亮（可选）：一枚描边光环比量测值滑到 highlightIndex 项
 *     （原版的 selection indicator；弹簧换用 transition + 同款
 *     SPRING 缓动，无量测循环）。
 * 裁掉项：键盘/悬停选中语义（游戏无删除、无列表选中态）、滚动渐隐
 * 遮罩、hugeicons、默认样例数据、滚动视口与 dark/light 主题。
 * 容器/条目标签可配（div 或 span）——MiniCardRow 挂在 <p> 里，
 * 必须 span 才合法。reduced-motion：全部立即到位，无错峰。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface AnimatedListItem {
  key: string;
  node: ReactNode;
  className?: string;
}

export interface AnimatedListProps {
  items: AnimatedListItem[];
  /** 入场姿态（默认 'pop'＝下弹入；'slide' 较远位移；'fade' 纯淡入） */
  animation?: 'pop' | 'slide' | 'fade' | 'none';
  /** 错峰间隔 ms（原版 stagger=0.05s） */
  staggerMs?: number;
  /** 排布方向：column 竖列（默认）/ row 横排（MiniCardRow 用） */
  direction?: 'column' | 'row';
  /** 容器与条目标签（'div' 或 'span'；嵌入 <p> 的行内列表用 'span'） */
  as?: 'div' | 'span';
  /** 滑行高亮贴到哪一项（-1/不传 = 不显示） */
  highlightIndex?: number;
  className?: string;
  /** 追加到每个条目 wrapper 的类名 */
  itemClassName?: string;
  ariaLabel?: string;
  /** 透传 aria-live（反思页逐人追加需要 polite 朗读） */
  live?: 'polite' | 'assertive' | 'off';
}

type Pose = 'above' | 'below' | 'in';

const HIDDEN: Record<string, Record<'above' | 'below', string>> = {
  pop: { above: 'translate3d(0, -12px, 0) scale(0.8)', below: 'translate3d(0, 12px, 0) scale(0.8)' },
  slide: { above: 'translate3d(0, -24px, 0) scale(0.98)', below: 'translate3d(0, 24px, 0) scale(0.98)' },
  fade: { above: 'translate3d(0, -4px, 0)', below: 'translate3d(0, 4px, 0)' },
};

/** 原版弹簧缓动（linear() 逐点曲线）；不支持 linear() 的环境退化三次贝塞尔 */
const SPRING =
  'linear(0, 0.0603, 0.2033, 0.3821, 0.5633, 0.7258, 0.8584, 0.9574, 1.0242, 1.0634, 1.0809, 1.0828, 1.0747, 1.0613, 1.046, 1.0313, 1.0186, 1.0085, 1.0012, 0.9965, 0.994, 0.9931, 0.9933, 0.9941, 0.9953, 0.9966, 0.9978, 0.9988, 1)';
const springEase =
  typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)')
    ? SPRING
    : 'cubic-bezier(0.34, 1.4, 0.64, 1)';

const ITEM_TRANSITION = `transform 560ms ${springEase}, opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)`;

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function AnimatedList({
  items,
  animation = 'pop',
  staggerMs = 50,
  direction = 'column',
  as = 'div',
  highlightIndex,
  className = '',
  itemClassName = '',
  ariaLabel,
  live,
}: AnimatedListProps) {
  const Tag = as as 'div';
  const [entered, setEntered] = useState<ReadonlySet<string>>(new Set());
  const enteredRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<number[]>([]);
  const wrapRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const glideRef = useRef<HTMLSpanElement>(null);

  /* —— 入场错峰：未入场的 key 排队 setTimeout 翻 'in'。
     后插入的项（新 key）同样排队，只播自己。reduced-motion 一次全入。 */
  useLayoutEffect(() => {
    const fresh = items.filter((it) => !enteredRef.current.has(it.key));
    if (fresh.length === 0) return;
    if (reduced() || animation === 'none') {
      for (const it of fresh) enteredRef.current.add(it.key);
      setEntered(new Set(enteredRef.current));
      return;
    }
    fresh.forEach((it, i) => {
      const t = window.setTimeout(() => {
        enteredRef.current.add(it.key);
        setEntered(new Set(enteredRef.current));
      }, 24 + i * Math.max(0, staggerMs));
      timersRef.current.push(t);
    });
    // 只依赖 items 内容；enteredRef 是命令式累加器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, animation, staggerMs]);

  useEffect(
    () => () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
    },
    [],
  );

  /* —— 滑行高亮：量目标项的 offset 写 --al-g*，transition 负责滑过去 */
  const showGlide =
    typeof highlightIndex === 'number' && highlightIndex >= 0 && highlightIndex < items.length;
  useLayoutEffect(() => {
    const glide = glideRef.current;
    const wrap = wrapRef.current;
    if (!glide || !wrap) return;
    if (!showGlide) {
      glide.style.setProperty('--al-glide-on', '0');
      return;
    }
    const measure = () => {
      const it = itemRefs.current.get(items[highlightIndex!].key);
      if (!it) return;
      const wr = wrap.getBoundingClientRect();
      const ir = it.getBoundingClientRect();
      glide.style.setProperty('--al-gx', `${(ir.left - wr.left).toFixed(1)}px`);
      glide.style.setProperty('--al-gy', `${(ir.top - wr.top).toFixed(1)}px`);
      glide.style.setProperty('--al-gw', `${ir.width.toFixed(1)}px`);
      glide.style.setProperty('--al-gh', `${ir.height.toFixed(1)}px`);
      glide.style.setProperty('--al-glide-on', '1');
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGlide, highlightIndex, items]);

  const poseFor = (key: string): Pose => (entered.has(key) || animation === 'none' ? 'in' : 'below');
  const hiddenPose = (key: string) => {
    const pose = poseFor(key);
    return pose !== 'in' && animation !== 'none' ? HIDDEN[animation][pose] : '';
  };

  return (
    <Tag
      ref={wrapRef as never}
      className={
        `rb-alist${direction === 'row' ? ' rb-alist--row' : ''}` +
        (className ? ` ${className}` : '')
      }
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      aria-live={live}
    >
      <span ref={glideRef} className="rb-al-glide" aria-hidden="true" />
      {items.map((it) => {
        const pose = hiddenPose(it.key);
        return (
          <Tag
            key={it.key}
            ref={(el: HTMLElement | null) => {
              itemRefs.current.set(it.key, el);
            }}
            className={`rb-al-item${itemClassName ? ` ${itemClassName}` : ''}${it.className ? ` ${it.className}` : ''}`}
            style={
              {
                transition: ITEM_TRANSITION,
                transform: pose || undefined,
                opacity: pose ? 0 : undefined,
              } as CSSProperties
            }
            data-state={poseFor(it.key)}
          >
            {it.node}
          </Tag>
        );
      })}
    </Tag>
  );
}
