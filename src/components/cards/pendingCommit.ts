/**
 * pendingCommit.ts —— R10C（interaction #2）后悔窗口：钱/答案「到账」之前
 * 先挂起一小段，期间孩子可以点撤销片（或点飞行中的卡）收回。
 * 纯表现层：不改引擎、不改命令集——到期才真正调 send()。
 * 与 React 解耦的纯类，node 环境单测直测（fake timers）。
 */

/** 默认后悔窗口时长（与 tokens.css --pending-ms 对齐） */
export const PENDING_MS = 1500;

export class PendingCommit {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private label = '';

  /**
   * @param ms 挂起时长（到期派发）
   * @param onChange 挂起标签变化通知（UI 用它渲染/撤掉撤销片）
   */
  constructor(
    private ms: number,
    private onChange?: (pendingLabel: string | null) => void,
  ) {}

  /** 当前挂起的标签；无挂起 → null */
  get pendingLabel(): string | null {
    return this.timer === null ? null : this.label;
  }

  /**
   * 挂起一次派发。已在挂起中时返回 false（拒绝叠发——同一窗口期
   * 只放一张卡，避免两笔一起「到账」）。
   */
  arm(label: string, run: () => void): boolean {
    if (this.timer !== null) return false;
    this.label = label;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.label = '';
      this.onChange?.(null);
      run();
    }, this.ms);
    this.onChange?.(label);
    return true;
  }

  /** 撤销挂起（尚未派发才有效）。返回是否真的撤销了一笔。 */
  cancel(): boolean {
    if (this.timer === null) return false;
    clearTimeout(this.timer);
    this.timer = null;
    this.label = '';
    this.onChange?.(null);
    return true;
  }

  dispose(): void {
    this.cancel();
  }
}
