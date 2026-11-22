/**
 * StationPopup.tsx —— 站点弹窗壳：横屏居中 dialog；竖屏整宽底部抽屉
 * （同一组件，CSS 媒体查询切换）。打开时焦点进入并被圈禁（useFocusTrap），
 * 关闭后还原。role="dialog" + aria-modal。
 * 站点弹窗不可 Esc（不进覆盖层栈）；复用本壳的帮助/钱包层传 onClose。
 *
 * R10D（education #6 / UI #8）：头部副行——站点学习目标小片（练 · …，
 * cardText.ts 既有文案）+ 迷你菜谱进度条（食材图标 ✓/缺口两态，数据
 * 与底栏同源的 missingIngredients/collected）。
 * R10D（interaction #8）：进出动画挂在 .popup 与退场壳 .popup-out 上
 * （180ms 入场 / 160ms 淡出 / reduced-motion 120ms 纯淡入），一处实现
 * 全部站点 + 求助牌 + 钱包抽屉受益；退场由下面的 PopupOutlet 延迟卸载。
 * 注：简报原写 240ms/150ms，Devin 落地为 180ms/160ms 并由 r10d.test.ts
 * 锁死（进出双时长断言）；PM 验收接受该偏差，差异记入 R10_DESIGN.md。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { strings } from '../data/strings';
import { useFocusTrap } from '../ui/useFocusTrap';
import { CardIcon } from './CardIcon';
import { SplitText } from './text/SplitText';

/* —— GradualBlur：React Bits by David Haz（MIT + Commons Clause，
   THIRD_PARTY_NOTICES.md 已登记）逐层遮罩渐进模糊——vendored & 裁剪：
   只留静态叠层核心（分层 backdrop-filter + 渐层 mask），去掉
   滚动/悬停联动。供 G3 弹窗遮罩四缘、G5 手机竖栏端缘复用 —— */
const GB_CURVES = {
  linear: (t: number) => t,
  bezier: (t: number) => t * t * (3 - 2 * t),
  'ease-in': (t: number) => t * t,
  'ease-out': (t: number) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
} as const;
const GB_DIRECTIONS = {
  top: 'to top',
  bottom: 'to bottom',
  left: 'to left',
  right: 'to right',
} as const;
const gbClamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const gbLen = (v: number | string | undefined) =>
  typeof v === 'number' ? `${v}px` : v;

export function GradualBlur({
  position = 'bottom',
  target = 'parent',
  height = '6rem',
  width,
  strength = 2,
  layers = 8,
  curve = 'linear',
  exponential = true,
  opacity = 1,
  saturation = 1,
  tint = 'transparent',
  zIndex = 1,
  className = '',
  style,
}: {
  position?: keyof typeof GB_DIRECTIONS;
  target?: 'parent' | 'page';
  height?: number | string;
  width?: number | string;
  strength?: number;
  layers?: number;
  curve?: keyof typeof GB_CURVES;
  exponential?: boolean;
  opacity?: number;
  saturation?: number;
  tint?: string;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const edge = GB_DIRECTIONS[position] ? position : 'bottom';
  const vertical = edge === 'top' || edge === 'bottom';

  const stack = useMemo(() => {
    const count = Math.min(Math.max(Math.round(layers) || 1, 1), 16);
    const shape = GB_CURVES[curve] || GB_CURVES.linear;
    const maxBlur = Math.max(strength, 0) * 12;
    const level = (u: number) => {
      const t = shape(gbClamp01(u));
      return maxBlur * (exponential ? (Math.pow(2, 4 * t) - 1) / 15 : t);
    };
    const boost = Math.pow(Math.max(saturation, 0), 1 / count);
    const direction = GB_DIRECTIONS[edge];
    const steps: CSSProperties[] = [];
    for (let i = 0; i < count; i++) {
      const from = level(i / count);
      const to = level((i + 1) / count);
      const radius = Math.sqrt(Math.max(to * to - from * from, 0));
      const filter = [
        `blur(${radius.toFixed(3)}px)`,
        boost !== 1 ? `saturate(${boost.toFixed(4)})` : '',
      ]
        .filter(Boolean)
        .join(' ');
      const mask = `linear-gradient(${direction}, transparent ${((i / count) * 100).toFixed(2)}%, #000 ${(((i + 1) / count) * 100).toFixed(2)}%)`;
      steps.push({
        position: 'absolute',
        inset: 0,
        backdropFilter: filter,
        WebkitBackdropFilter: filter,
        maskImage: mask,
        WebkitMaskImage: mask,
        opacity,
      });
    }
    let wash: CSSProperties | null = null;
    if (tint && tint !== 'transparent') {
      const stops = Array.from({ length: 9 }, (_, k) => {
        const u = k / 8;
        const t = shape(u);
        const a = t * t * t * (t * (t * 6 - 15) + 10);
        return `rgba(0, 0, 0, ${a.toFixed(3)}) ${(u * 100).toFixed(1)}%`;
      }).join(', ');
      wash = {
        position: 'absolute',
        inset: 0,
        background: tint,
        maskImage: `linear-gradient(${direction}, ${stops})`,
        WebkitMaskImage: `linear-gradient(${direction}, ${stops})`,
      };
    }
    return { steps, wash };
  }, [layers, curve, strength, exponential, saturation, edge, opacity, tint]);

  const depth = gbLen(vertical ? height : width ?? height);
  const span = vertical && width != null ? gbLen(width) : null;
  const rounded = target !== 'page' && !span;
  const corner = (a: string, b: string) =>
    rounded && (edge === a || edge === b) ? 'inherit' : undefined;

  const rootStyle: CSSProperties = {
    position: target === 'page' ? 'fixed' : 'absolute',
    zIndex,
    borderTopLeftRadius: corner('top', 'left'),
    borderTopRightRadius: corner('top', 'right'),
    borderBottomLeftRadius: corner('bottom', 'left'),
    borderBottomRightRadius: corner('bottom', 'right'),
    top: edge === 'bottom' ? undefined : 0,
    bottom: edge === 'top' ? undefined : 0,
    left: edge === 'right' ? undefined : 0,
    right: edge === 'left' ? undefined : 0,
    height: vertical ? depth : undefined,
    width: vertical ? span ?? undefined : depth,
    marginInline: span ? 'auto' : undefined,
    ...style,
  };

  return (
    <div
      className={`gradual-blur ${className}`.trim()}
      style={rootStyle}
      aria-hidden="true"
    >
      {stack.steps.map((layer, i) => (
        <div key={i} style={layer} />
      ))}
      {stack.wash && <div style={stack.wash} />}
    </div>
  );
}

/** 菜谱进度条的一项（调用方用既有 selector 数据拼好递进来） */
export interface RecipeStripItem {
  id: string;
  icon: string;
  got: boolean;
}

export function StationPopup({
  title,
  tag,
  aside,
  badge,
  recipe,
  onClose,
  testid,
  children,
}: {
  title: string;
  tag?: string;
  aside?: string;
  /** R2-6：浮签右边的内容角标（如市场「金币 ×N」），渲染在头部右侧 */
  badge?: ReactNode;
  /** R10D：迷你菜谱进度条（食材图标 + 买到 ✓ / 还缺口）。
   *  消息减负审计 B17：原「练 · …」学习目标小片（goal）已删——
   *  目标文案是给老师看的元信息，孩子在站里要做的事由面板正文说 */
  recipe?: RecipeStripItem[];
  onClose?: () => void;
  testid?: string;
  children: ReactNode;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  return (
    <div className="popup-backdrop">
      {/* G3（React Bits GradualBlur）：遮罩四缘渐进模糊——只加边缘
          处理，dim 颜色/透明度不变；手机竖栏内由 phone.css 隐藏 */}
      <GradualBlur position="top" height="12%" strength={1.1} layers={5} />
      <GradualBlur position="bottom" height="12%" strength={1.1} layers={5} />
      <GradualBlur position="left" width="7%" strength={1.1} layers={5} />
      <GradualBlur position="right" width="7%" strength={1.1} layers={5} />
      <div
        ref={ref}
        className="popup"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testid}
      >
        <header className="popup-head">
          <div className="popup-head-main">
            {/* WS3 C15：弹窗标题逐字错峰入场（Split Text 改写，motion；
                key=text 在 SplitText 内部——换站重播） */}
            <SplitText as="h2" className="popup-title" text={title} />
            {recipe && recipe.length > 0 && (
              <div className="popup-sub">
                {recipe && recipe.length > 0 && (
                  <span
                    className="popup-recipe"
                    role="img"
                    aria-label={strings.hud.recipeStrip}
                  >
                    {recipe.map((it) => (
                      <span
                        key={it.id}
                        className={
                          'rcp-item' + (it.got ? ' rcp-item--got' : '')
                        }
                        aria-hidden="true"
                      >
                        <CardIcon icon={it.icon} />
                        {it.got && <i className="rcp-check">✓</i>}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )}
          </div>
          {tag && <span className="popup-tag">{tag}</span>}
          {badge}
          {aside && <span className="popup-aside">{aside}</span>}
          {onClose && (
            <button type="button" className="popup-close" onClick={onClose} aria-label={strings.actions.close}>
              ✕
            </button>
          )}
        </header>
        <div className="popup-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * PopupOutlet —— R10D 弹窗退场宿主：show 由 true → false 时把最后一份
 * 弹窗多留 ~160ms（挂 .popup-out 播淡出），让「关」也看得见。
 * display:contents 壳不掺和布局（竖栏 flex / 桌面 fixed 都不受影响）。
 * 站点弹窗、求助牌、钱包抽屉都包它——一处实现，三处受益。
 */
export function PopupOutlet({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(show);
  const last = useRef(children);
  if (children != null) last.current = children;
  const leaving = visible && !show;

  useEffect(() => {
    if (show) {
      setVisible(true);
      return undefined;
    }
    /* R10E（e2e 修复）：?fast=1 下不等 170ms 淡出尾——软渲染主线程
       被钉死时该定时器可延迟数秒，钱包/求助抽屉的「Esc 关闭」断言
       超时（keyboard e2e）。fast 只供测试驱动，退场演出本来不看。 */
    if (new URLSearchParams(window.location.search).get('fast') === '1') {
      setVisible(false);
      return undefined;
    }
    const t = window.setTimeout(() => setVisible(false), 170);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!visible) return null;
  return (
    <div
      className={'popup-shell' + (leaving ? ' popup-out' : '')}
      aria-hidden={leaving ? true : undefined}
    >
      {show ? children : last.current}
    </div>
  );
}
