/**
 * PendingChip.tsx —— R10C 后悔窗口的撤销片：派发挂起期间显示的
 * 大按钮「等等！收回xxx」。倒计时用 ::after 底条动画（transform/opacity
 * 的兄弟方案：宽度动画换 scaleX——纯 transform）。keyboard 自然可达
 * （原生 button），Esc 也可撤销（由调用方挂在全局 Esc 或此处自带）。
 */
import { useEffect } from 'react';
import { strings } from '../../data/strings';
import { fmt } from '../../game/stations/shared';

export function PendingChip({
  label,
  windowMs = 1500,
  onCancel,
}: {
  /** 挂起中的展示名（卡名/答案句） */
  label: string;
  windowMs?: number;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <button
      type="button"
      className="pending-chip"
      style={{ '--pending-ms': `${windowMs}ms` } as React.CSSProperties}
      onClick={onCancel}
    >
      <span className="pending-chip-ico" aria-hidden="true">
        ⏮
      </span>
      {fmt(strings.regret.undo, { item: label })}
      <span className="pending-chip-bar" aria-hidden="true" />
    </button>
  );
}
