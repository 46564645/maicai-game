/**
 * Toast.tsx —— 动作提示浮条：顶部一次只显示一条（ww M4.5.5：不叠条，
 * 新提示直接替换旧的），把最近一次命令产生的日志条目（如「小冲买了贴纸」）
 * 显示出来；aria-live 供读屏。pointer-events 关闭，不挡操作。
 */
import type { LogEntry } from '../game/types';

export function Toast({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="toast-stack" data-testid="toast-log" aria-live="polite">
      {entries.slice(-1).map((e) => (
        <p key={e.id} className="toast">
          {e.text}
        </p>
      ))}
    </div>
  );
}
