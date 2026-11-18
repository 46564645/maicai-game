/**
 * useDragPlay.ts —— R10 自研拖拽打出层（React Bits 无现成「拖到目标区」组件）。
 *
 * Pointer Events + setPointerCapture：按住卡超过阈值（8px）判拖，之下算点按；
 * 位移实时写 transform（rAF 不需要——pointermove 本来就按帧来），命中投放区
 * （getBoundingClientRect 矩形命中）且该区 accepts → 松手调用 onDrop；
 * 未命中/被拒/中途取消 → 弹簧弹回手牌位（CSS transition，reduced-motion 120ms）。
 * 桌面指针叠加 Magnet 吸附：指针进入投放区外扩 pad 范围内，卡被轻吸向区心。
 * 拖拽之外永远保留「点选—点目标」tap-tap 等价路径（本 hook 不处理点按，
 * 点按由底层 <button> 的原生 click 走既有选中→动作流程）。
 *
 * 纯函数（exceedsDragThreshold / hitTestZone / resolveDrop / magnetDelta）
 * 与 React 解耦，node 环境单测直测（tests/unit/dragPlay.test.ts）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/* ================= 纯函数（可单测） ================= */

export interface PointLike {
  x: number;
  y: number;
}
export interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ZoneRect {
  id: string;
  rect: RectLike;
  /** false = 命中也算无效投放（弹回 + 轻 shake） */
  accepts: boolean;
}

/** 位移超过阈值才算「拖」（之下交给原生 click = 点按） */
export function exceedsDragThreshold(dx: number, dy: number, threshold = 8): boolean {
  return dx * dx + dy * dy > threshold * threshold;
}

/* R10C（interaction #1）：指针分型阈值——手指指腹在屏幕上天然有
   10px+ 的慢漂移，8px 的鼠标阈值会把「想点一下」误判成「拖了一下」
   再把紧跟的 click 吞掉（孩子觉得卡「点不动」）。鼠标仍 8px，
   触屏/触笔 18px，且松手时小位移短时长一律tap-rescue回点按。 */
export const DRAG_THRESHOLD_MOUSE = 8;
export const DRAG_THRESHOLD_TOUCH = 18;
export const TAP_RESCUE_DIST = 26;
export const TAP_RESCUE_MS = 300;

export function dragThresholdFor(pointerType: string): number {
  return pointerType === 'mouse' ? DRAG_THRESHOLD_MOUSE : DRAG_THRESHOLD_TOUCH;
}

/** tap-rescue：松手时全程位移 <26px 且按住 <300ms → 仍算点按 */
export function isTapRescue(dx: number, dy: number, elapsedMs: number): boolean {
  return dx * dx + dy * dy < TAP_RESCUE_DIST * TAP_RESCUE_DIST && elapsedMs < TAP_RESCUE_MS;
}

/** 矩形命中：返回包含点的所有区中面积最小者（嵌套区时小者优先），无 → null */
export function hitTestZone(p: PointLike, zones: ZoneRect[]): ZoneRect | null {
  let best: ZoneRect | null = null;
  let bestArea = Infinity;
  for (const z of zones) {
    const { x, y, w, h } = z.rect;
    if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) {
      const area = w * h;
      if (area < bestArea) {
        best = z;
        bestArea = area;
      }
    }
  }
  return best;
}

export type DropVerdict =
  | { kind: 'accept'; id: string }
  | { kind: 'reject' } // 命中了不接受的区
  | { kind: 'miss' }; // 谁也没碰到

export function resolveDrop(p: PointLike, zones: ZoneRect[]): DropVerdict {
  const z = hitTestZone(p, zones);
  if (!z) return { kind: 'miss' };
  return z.accepts ? { kind: 'accept', id: z.id } : { kind: 'reject' };
}

export interface MagnetPull {
  /** 应叠加在拖拽位移上的吸附偏移（朝区心方向的 1/3） */
  dx: number;
  dy: number;
  zoneId: string;
}

/**
 * Magnet 吸附：指针进入某接受区外扩 pad 的矩形内，返回把卡拉向区心的
 * 偏移量（取到区心距离的 1/3，柔和不抢手感）。多区命中取最近区心。
 */
export function magnetDelta(
  p: PointLike,
  zones: ZoneRect[],
  pad: number,
): MagnetPull | null {
  let best: MagnetPull | null = null;
  let bestDist = Infinity;
  for (const z of zones) {
    if (!z.accepts) continue;
    const { x, y, w, h } = z.rect;
    if (
      p.x < x - pad ||
      p.x > x + w + pad ||
      p.y < y - pad ||
      p.y > y + h + pad
    ) {
      continue;
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    const dist = Math.hypot(cx - p.x, cy - p.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { dx: (cx - p.x) / 3, dy: (cy - p.y) / 3, zoneId: z.id };
    }
  }
  return best;
}

/* ================= React hook ================= */

export interface DropZoneRef {
  id: string;
  /** 每次拖动时现取 rect（区会脉动/移动，缓存 rect 会失准） */
  el: HTMLElement | null;
  accepts: boolean;
}

export interface UseDragPlayOptions<T> {
  /**  false = 完全不可拖（不可打的卡：不发光、拖出必弹回由 accepts 表达） */
  enabled: boolean;
  payload: T;
  /** 返回当前投放区列表（元素引用在每次 pointermove 时取 rect） */
  zones: () => DropZoneRef[];
  /** 松手命中可接受区时回调（此时才派发命令） */
  onDrop: (payload: T, zoneId: string) => void;
  /** Magnet 外扩距离（px），默认 24；只作用于 mouse 指针 */
  magnetPad?: number;
}

export interface UseDragPlay {
  /** 绑到包裹卡面的 .hand-drag 元素上 */
  ref: (el: HTMLElement | null) => void;
  /** 应用到 .hand-drag 的 style（弹回过渡用） */
  style: CSSProperties;
  dragging: boolean;
  returning: boolean;
  /** 回弹落地后的轻 shake（≤200ms，不弹文字） */
  shaking: boolean;
}

const RETURN_MS = 420;
const RETURN_MS_RM = 120;
const SHAKE_MS = 180;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

const HOT_CLASS = 'drop-zone--hot';
const MISS_CLASS = 'drop-zone--rejecting';

interface ZoneRectDom extends ZoneRect {
  el: HTMLElement | null;
}

/** 现取每个投放区的 rect（DOMRect → RectLike 归一） */
function measureZones(zones: DropZoneRef[]): ZoneRectDom[] {
  return zones.map((z) => {
    const r = z.el?.getBoundingClientRect();
    return {
      id: z.id,
      rect: r
        ? { x: r.x, y: r.y, w: r.width, h: r.height }
        : { x: 0, y: 0, w: 0, h: 0 },
      accepts: z.accepts,
      el: z.el,
    };
  });
}

export function useDragPlay<T>(opts: UseDragPlayOptions<T>): UseDragPlay {
  const elRef = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [returning, setReturning] = useState(false);
  const [shaking, setShaking] = useState(false);
  const stateRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    pointerType: 'mouse' as string,
    startT: 0,
  });
  const timersRef = useRef<number[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const clearZoneMarks = useCallback(() => {
    for (const z of optsRef.current.zones()) {
      z.el?.classList.remove(HOT_CLASS, MISS_CLASS);
    }
  }, []);

  const applyTransform = useCallback((dx: number, dy: number) => {
    const el = elRef.current;
    if (!el) return;
    const rot = Math.max(-8, Math.min(8, dx / 24));
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg) scale(1.05)`;
  }, []);

  const resetTransform = useCallback((animate: boolean) => {
    const el = elRef.current;
    if (!el) return;
    el.style.transition = animate
      ? `transform ${prefersReducedMotion() ? RETURN_MS_RM : RETURN_MS}ms var(--ease-spring)`
      : 'none';
    el.style.transform = '';
  }, []);

  const finish = useCallback(
    (verdict: DropVerdict, payload: T) => {
      clearZoneMarks();
      if (verdict.kind === 'accept') {
        // 命中：立即复位视觉（命令引发的 state 更新会让手牌重排）+
        // 投放区轻弹一下确认「收下了」（PlaySpark 在 Slice B 再叠）
        resetTransform(false);
        setDragging(false);
        const zoneEl = optsRef.current
          .zones()
          .find((z) => z.id === verdict.id)?.el;
        if (zoneEl) {
          zoneEl.classList.add('drop-zone--pop');
          timersRef.current.push(
            window.setTimeout(() => zoneEl.classList.remove('drop-zone--pop'), 320),
          );
        }
        optsRef.current.onDrop(payload, verdict.id);
        return;
      }
      // 无效投放：弹簧弹回 + （命中但拒收时）轻 shake
      setReturning(true);
      setDragging(false);
      resetTransform(true);
      const back = prefersReducedMotion() ? RETURN_MS_RM : RETURN_MS;
      timersRef.current.push(
        window.setTimeout(() => {
          setReturning(false);
          const el = elRef.current;
          if (el) el.style.transition = '';
          if (verdict.kind === 'reject') {
            setShaking(true);
            timersRef.current.push(window.setTimeout(() => setShaking(false), SHAKE_MS));
          }
        }, back + 20),
      );
    },
    [clearZoneMarks, resetTransform],
  );

  const onMove = useCallback(
    (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st.active || e.pointerId !== st.pointerId) return;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (!st.moved && !exceedsDragThreshold(dx, dy, dragThresholdFor(st.pointerType)))
        return;
      if (!st.moved) {
        st.moved = true;
        setDragging(true);
        const el = elRef.current;
        if (el) el.style.transition = 'none';
      }
      const zones = measureZones(optsRef.current.zones());
      const point = { x: e.clientX, y: e.clientY };
      const hit = hitTestZone(point, zones);
      // 区反馈：可接受且命中 → hot；命中但拒收 → rejecting；其余清除
      for (const z of zones) {
        const isHit = hit?.id === z.id;
        z.el?.classList.toggle(HOT_CLASS, isHit && z.accepts);
        z.el?.classList.toggle(MISS_CLASS, isHit && !z.accepts);
      }
      // Magnet：仅桌面鼠标指针（触屏的吸附在松手判定里做——命中即收）
      let ox = dx;
      let oy = dy;
      if (st.pointerType === 'mouse' && !hit) {
        const m = magnetDelta(point, zones, optsRef.current.magnetPad ?? 24);
        if (m) {
          ox += m.dx;
          oy += m.dy;
        }
      }
      applyTransform(ox, oy);
      e.preventDefault();
    },
    [applyTransform],
  );

  const onUp = useCallback(
    (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st.active || e.pointerId !== st.pointerId) return;
      st.active = false;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (!st.moved) return; // 点按：交给原生 click
      // R10C tap-rescue：过了起拖阈值但松手时仍像「按住顿了一下」
      // （小位移 + 短时长）→ 退回点按路径：卡复位、click 放行去选中
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (isTapRescue(dx, dy, e.timeStamp - st.startT)) {
        st.moved = false;
        clearZoneMarks();
        resetTransform(false);
        setDragging(false);
        return;
      }
      const zones = measureZones(optsRef.current.zones());
      finish(resolveDrop({ x: e.clientX, y: e.clientY }, zones), optsRef.current.payload);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish, onMove],
  );

  const onCancel = useCallback(
    (e: PointerEvent) => {
      const st = stateRef.current;
      if (!st.active || e.pointerId !== st.pointerId) return;
      st.active = false;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (st.moved) finish({ kind: 'miss' }, optsRef.current.payload);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish, onMove],
  );

  const onDown = useCallback(
    (e: PointerEvent) => {
      if (!optsRef.current.enabled || !e.isPrimary || e.button !== 0) return;
      const st = stateRef.current;
      st.active = true;
      st.moved = false;
      st.pointerId = e.pointerId;
      st.pointerType = e.pointerType;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.startT = e.timeStamp;
      try {
        elRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* jsdom / 旧浏览器无实现也无妨——window 级监听兜底 */
      }
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
    },
    [onMove, onUp, onCancel],
  );

  // 拖拽后吞掉紧跟的 click（否则拖完会触发选中切换）
  const onClickCapture = useCallback((e: MouseEvent) => {
    if (stateRef.current.moved) {
      stateRef.current.moved = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (elRef.current) {
        elRef.current.removeEventListener('pointerdown', onDown);
        elRef.current.removeEventListener('click', onClickCapture, true);
      }
      elRef.current = el;
      if (el) {
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('click', onClickCapture, true);
      }
    },
    [onDown, onClickCapture],
  );

  useEffect(
    () => () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
    },
    [onMove, onUp, onCancel],
  );

  const style: CSSProperties =
    dragging || returning
      ? { willChange: 'transform', position: 'relative', zIndex: 30 }
      : { position: 'relative' };

  return { ref, style, dragging, returning, shaking };
}
