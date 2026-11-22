/**
 * Toast.tsx —— 动作提示浮条（toast-4s 定稿口径）：
 * - 排队：同屏只显示一条；新到日志按序排进队列（src/ui/toastQueue.ts），
 *   前一条 4s dwell 结束或被点掉后下一条接上，绝不叠条/抢条。
 * - 合并：连续的 bot 动作条并入队尾的可合并条，组成一行「A · B · C」
 *   组合行，不逐条轮播一长串；正在显示的条被并入新内容时 rev+1
 *   重计 4s，保证新文字读满一个 dwell。
 * - 点按即关：整条是一个 button（≥48px 点击区、可键盘 Enter/空格），
 *   点了走同一段 300ms 淡出再卸载；.toast-stack 仍 pointer-events:none，
 *   只有条本体吃点击，不挡条外操作。
 * - WS4 D1/A11：条本体仍走既有 .toast 样式与淡出路径，外包收编的
 *   SwipeToast（React Bits）提供：① 入场轻落下；② 底部燃烧引线把
 *   4s dwell 画成倒计时；③ 新增上下滑甩关断（与点按走同一条
 *   dismiss() 淡出路径）。层级/投影/选中发光一概不动（并行流所有）。
 * - aria-live 供读屏；层级排在站点弹窗之下（hud.css .toast-stack
 *   z-index < .popup-backdrop），有卡片弹出时不得盖住卡片。
 *   时长常量 TOAST_VISIBLE_MS 与 tokens.css 的 --toast-visible-ms
 *   同值，要调一起调。
 */
import { useEffect, useRef, useState } from 'react';
import type { LogEntry, PlayerId } from '../game/types';
import { localizeLogText } from '../i18n/cardText';
import { strings } from '../data/strings';
import { enqueueToastEntries, type ToastItem } from '../ui/toastQueue';
import { SwipeToast } from './SwipeToast';

/** 提示条可见时长（ms）：定稿 4s（含末尾淡出段） */
export const TOAST_VISIBLE_MS = 4000;
/** 消失前淡出段（ms）：与 hud.css .toast 的 opacity 过渡同值 */
const TOAST_FADE_MS = 300;
/** 组合行多条之间的连接符（语言中立的间隔点） */
const JOIN_SEP = ' · ';

export function Toast({
  entries,
  humanId,
}: {
  entries: LogEntry[];
  humanId?: PlayerId;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  /* 已进队的日志 id 上限（引擎日志 id = log 数组下标，单调递增） */
  const lastSeenRef = useRef(-1);

  /* 新日志进队。log 数组变短/重头编号（RESTART 开新局重建）→ 队列
     与可见条一起清、计数重新对齐；同一条目重渲染不进队 */
  useEffect(() => {
    let seen = lastSeenRef.current;
    let base: ToastItem[] | null = null;
    const tailId = entries.length ? entries[entries.length - 1].id : -1;
    if (tailId < seen) {
      seen = -1;
      base = [];
    }
    const fresh = entries.filter((e) => e.id > seen);
    lastSeenRef.current = fresh.length ? fresh[fresh.length - 1].id : seen;
    if (base === null && fresh.length === 0) return;
    setItems((prev) => enqueueToastEntries(base ?? prev, fresh, humanId));
  }, [entries, humanId]);

  /* 消息减负审计 B10：一次性说明条（notice）通道已删——记号图例
     迁入新手指南，Toast 只剩日志队列一条来源 */

  const current = items[0];
  /* key+rev 合一作条实例标识：并入新内容 rev 变 → 视作新实例重计 4s */
  const itemId = current ? `${current.key}:${current.rev}` : null;
  const leaving = itemId !== null && leavingId === itemId;

  /* 队首条 dwell 4s：末 300ms 淡出，到时卸载、下一条接上 */
  useEffect(() => {
    if (itemId === null) return undefined;
    const fade = window.setTimeout(
      () => setLeavingId(itemId),
      TOAST_VISIBLE_MS - TOAST_FADE_MS,
    );
    const hide = window.setTimeout(
      () =>
        setItems((prev) =>
          prev[0] && `${prev[0].key}:${prev[0].rev}` === itemId
            ? prev.slice(1)
            : prev,
        ),
      TOAST_VISIBLE_MS,
    );
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [itemId]);

  /* 点按即关：先淡出、卸载交给与自动消失同口径的 300ms；若淡出期间
     该条被并入新内容（rev 变），不卸载新实例 */
  const dismiss = () => {
    if (itemId === null) return;
    setLeavingId(itemId);
    const id = itemId;
    window.setTimeout(
      () =>
        setItems((prev) =>
          prev[0] && `${prev[0].key}:${prev[0].rev}` === id
            ? prev.slice(1)
            : prev,
        ),
      TOAST_FADE_MS,
    );
  };

  if (!current) return null;
  return (
    <div className="toast-stack" data-testid="toast-log" aria-live="polite">
      {/* WS4 D1：收编 SwipeToast 包装条——key 用条实例标识（并入新内容
          rev 变 → 视作新实例：重播入场、引线重烧、4s 重计，三处同源） */}
      <SwipeToast key={itemId} duration={TOAST_VISIBLE_MS} onSwipe={dismiss}>
        <button
          type="button"
          className={'toast' + (leaving ? ' toast--leaving' : '')}
          onClick={dismiss}
        >
          <span className="toast-text">
            {/* R2-7：引擎烘焙的日志槽位是英文原文名，显示层按当前语言重渲染；
                合并条的 bot 动作原文各自本地化后以间隔点连成一行。
                raw 条（UI 说明）已是成品文案，直出 */}
            {current.raw
              ? current.texts.join(JOIN_SEP)
              : current.texts.map(localizeLogText).join(JOIN_SEP)}
          </span>
          <span className="toast-x" aria-hidden="true">
            ×
          </span>
          <span className="sr-only">{strings.actions.close}</span>
        </button>
      </SwipeToast>
    </div>
  );
}
