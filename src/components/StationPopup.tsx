/**
 * StationPopup.tsx —— 站点弹窗壳：横屏居中 dialog；竖屏整宽底部抽屉
 * （同一组件，CSS 媒体查询切换）。打开时焦点进入并被圈禁（useFocusTrap），
 * 关闭后还原。role="dialog" + aria-modal。
 * 站点弹窗不可 Esc（不进覆盖层栈）；复用本壳的帮助/钱包层传 onClose。
 */
import type { ReactNode } from 'react';
import { strings } from '../data/strings';
import { useFocusTrap } from '../ui/useFocusTrap';

export function StationPopup({
  title,
  tag,
  aside,
  onClose,
  testid,
  children,
}: {
  title: string;
  tag?: string;
  aside?: string;
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
          <h2 className="popup-title">{title}</h2>
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
