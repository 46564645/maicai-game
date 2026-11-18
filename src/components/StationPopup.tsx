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
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { strings } from '../data/strings';
import { useFocusTrap } from '../ui/useFocusTrap';
import { CardIcon } from './CardIcon';

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
  goal,
  recipe,
  onClose,
  testid,
  children,
}: {
  title: string;
  tag?: string;
  aside?: string;
  /** R10D：站点学习目标小片（「练 · …」） */
  goal?: string;
  /** R10D：迷你菜谱进度条（食材图标 + 买到 ✓ / 还缺口） */
  recipe?: RecipeStripItem[];
  onClose?: () => void;
  testid?: string;
  children: ReactNode;
}) {
  const ref = useFocusTrap<HTMLDivElement>(true);
  return (
    <div className="popup-backdrop">
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
            <h2 className="popup-title">{title}</h2>
            {(goal || (recipe && recipe.length > 0)) && (
              <div className="popup-sub">
                {goal && <span className="popup-goal">{goal}</span>}
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
