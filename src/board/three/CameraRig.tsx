/**
 * CameraRig.tsx —— drei OrbitControls + 每帧 target.lerp 轻跟随当前棋子
 * （借 monopoly-3d CameraRig 的写法：limit 俯角/远近 + 阻尼）。
 * 焦点模式借 closing-quest：auto（总览/跟当前站）/ spinner（转盘推近特写，
 * 落定后缓回俯视）；resetKey 变化时平滑回默认视角（DOM「回默认视角」按钮）。
 * 孩子一上手拖动（onStart）就打断回位/推近，相机永远归孩子管。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { stationAnchor } from './positions';
import { solveFit, type FreeRect } from './fitSolver';

export type CameraFocus = 'auto' | 'spinner';

/** 默认机位：约 50° 斜俯视 + 窄 FOV 27（ART_3D §9.2 高角度斜俯视、窄视角、
 *  「桌上模型」沙盘感），全岛 + 一圈水面入画，画面略上移给底部 overlay 让位 */
const DEFAULT_POS = new THREE.Vector3(0, 21, 18);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0.4);
/** 转盘推近：注视岛心转盘上沿，相机降到更低更近（仍在 OrbitControls 限制内，
 *  距离随窄 FOV 同比例拉远：旧 6.6/5.9@fov37 → 约 9.4/8.3@fov27） */
const SPINNER_TARGET = new THREE.Vector3(0, 0.5, -0.4);
const SPINNER_POS = new THREE.Vector3(0, 9.4, 8.3);

/**
 * 取景沿革：T5 起用 fit-solve（外廓 8 角投影 + 二分求距，无经验倍率）；
 * R5 用 FIT_RECT/FIT_SHIFT 两档常量把填充调到 60–70%——但分数常量与
 * 尺寸无关：窗口越大岛按像素同比放大，大屏（1600×1000 / 1920×1080）
 * 填充冲到 0.73 / 0.78、rim 宽于自由带；窄屏又靠档位猜。
 * R8 改为连续求解（fitSolver.ts）：自由矩形由下方 measureFreeRect
 * 实测真实 DOM chrome 得到，求解器直接解出「rim 在自由矩形内居中、
 * 面积 = 0.66 × 自由矩形、且全部跟随目标下不越界」的基点与距离，
 * 任意视口同一套机制（见 RESPONSIVE_R8.md）。
 */

/**
 * R5 跟随幅度（目标点向当前站锚点的混合比）：0.45/0.72 → 0.12/0.05。
 * 取景目标是「小岛占自由带 60–70%」——跟随越多，所有跟随位都满足
 * 约束所需的机位越远、岛越小；收小后镜头仍平滑移向当前棋子，
 * 但岛几乎不滑出带（对小孩也稳）。R8 保留：它不是尺寸常量，
 * 是已验收的跟随手感（MERGE_R5 跟随量化：桌面棋子移 15.6px、
 * 手机 3.7px，PM 裁决接受）。
 */
const FOLLOW_MIX = { desktop: 0.12, compact: 0.05 } as const;

const CHROME_SELECTORS = [
  '.game-topbar',
  '.game-left',
  '.game-right',
  '.board3d-overlay',
  '.game-bottom',
  '.phone-rail',
  '.phone-bots',
  '.phone-quick',
];

/**
 * 实测自由矩形（画布像素 = 视口坐标，画布 fixed 铺满全屏）：
 * 桌面 = 左右 bot 列内缘 × 顶条下沿 → 底部栈顶（提示条顶，无条时
 * 底栏顶）；手机 = 头像排下沿 → 圆钮区顶、右到竖栏左缘（头像排
 * 左缘 −8 还原安全区左距）。与 R5 自由带定义一致（1280×800 实测
 * 868×539、874×402 实测 612×282，RESPONSIVE_R8.md 复核）。
 * chrome 缺失（尚未布局/2D 回退瞬间）返回 null，用兜底分数。
 */
function measureFreeRect(compact: boolean): FreeRect | null {
  if (typeof document === 'undefined') return null;
  const rect = (sel: string): DOMRect | null => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  };
  if (compact) {
    const rail = rect('.phone-rail');
    if (!rail) return null;
    const bots = rect('.phone-bots');
    const quick = rect('.phone-quick');
    const left = bots ? Math.max(0, bots.left - 8) : 0;
    const top = bots ? bots.bottom : 0;
    const bottom = quick ? quick.top : window.innerHeight;
    return { x: left, y: top, w: rail.left - left, h: bottom - top };
  }
  const left = rect('.game-left');
  const right = rect('.game-right');
  const topbar = rect('.game-topbar');
  if (!left || !right || !topbar) return null;
  const overlay = rect('.board3d-overlay');
  const bottomBar = rect('.game-bottom');
  const bottom = overlay ? overlay.top : bottomBar ? bottomBar.top : window.innerHeight;
  return {
    x: left.right,
    y: topbar.bottom,
    w: right.left - left.right,
    h: bottom - topbar.bottom,
  };
}

/** 兜底自由矩形（参考视口实测值的分数形式，仅 chrome 未就绪时用） */
function fallbackFreeRect(compact: boolean, w: number, h: number): FreeRect {
  return compact
    ? { x: 0, y: 0.139 * h, w: 0.7 * w, h: 0.701 * h }
    : { x: 0.161 * w, y: 0.09 * h, w: 0.678 * w, h: 0.674 * h };
}

function sameRect(a: FreeRect, b: FreeRect): boolean {
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.w - b.w) < 1 &&
    Math.abs(a.h - b.h) < 1
  );
}

export function CameraRig({
  followStation,
  resetKey,
  focus = 'auto',
  compact = false,
  onUserGesture,
}: {
  /** 当前行动者所在站（轻跟随目标；null = 总览） */
  followStation: number | null;
  resetKey: number;
  /** 'spinner' = 转盘演出中，推近岛心；回 'auto' 时缓回俯视 */
  focus?: CameraFocus;
  /** M4.5.6 手机横屏窄画布：镜头更近、更贴近当前棋子（对准自己的棋子） */
  compact?: boolean;
  /** 用户拖动/捏合起手 → 打断推近（Scene 用来跳过转盘演出） */
  onUserGesture?: () => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const goal = useRef(new THREE.Vector3().copy(DEFAULT_TARGET));
  const resetting = useRef(false);
  const returning = useRef(false); // 推近结束后缓回默认机位
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  // R8：自由矩形实测（chrome 布局变化时经 ResizeObserver 刷新；
  // window resize 亦触发）。首帧 chrome 可能未就绪 → 先用兜底分数，
  // effect 挂载后立即以实测值替换并重解（孩子未上手前 home 会跟随）。
  const [freeRect, setFreeRect] = useState<FreeRect>(() =>
    fallbackFreeRect(compact, size.width, size.height),
  );
  useEffect(() => {
    const update = () => {
      const r = measureFreeRect(compact);
      if (r) setFreeRect((prev) => (sameRect(prev, r) ? prev : r));
    };
    update();
    window.addEventListener('resize', update);
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) {
      for (const sel of CHROME_SELECTORS) {
        document.querySelectorAll(sel).forEach((el) => ro.observe(el));
      }
    }
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [compact]);

  // R8：home 取景由 solveFit 按实测自由矩形连续求解（居中 + 填充
  // 0.66 + 跟随不越界）；转盘推近距离按同一比例缩放，保持相对幅度
  const fit = useMemo(
    () =>
      solveFit({
        width: size.width,
        height: size.height,
        free: freeRect,
        mix: compact ? FOLLOW_MIX.compact : FOLLOW_MIX.desktop,
        dir: DEFAULT_POS.clone().normalize(),
      }),
    [size.width, size.height, freeRect, compact],
  );
  const fitD = fit.distance;
  const base = fit.base;
  const homePos = base.clone()
    .addScaledVector(DEFAULT_POS.clone().normalize(), fitD);
  const spinnerPos = SPINNER_POS.clone().multiplyScalar(
    THREE.MathUtils.clamp(fitD / DEFAULT_POS.length(), 1, 1.7),
  );
  const interacted = useRef(false);

  // 首帧（及孩子未上手前的画幅变化）把相机摆到 fit 距离
  useEffect(() => {
    if (!interacted.current) {
      camera.position.copy(homePos);
      invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homePos.x, homePos.y, homePos.z]);

  // 「回默认视角」：开始回正动画
  useEffect(() => {
    if (resetKey > 0) {
      resetting.current = true;
      invalidate();
    }
  }, [resetKey, invalidate]);

  // 跟随目标 / 焦点变化时请求渲染；转盘落定回 auto → 缓回默认机位
  const prevFocus = useRef(focus);
  useEffect(() => {
    if (prevFocus.current === 'spinner' && focus === 'auto') returning.current = true;
    prevFocus.current = focus;
    invalidate();
  }, [followStation, focus, invalidate]);

  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;

    if (resetting.current) {
      // 回正：相机位置与注视点都缓动回默认，到位即停
      c.object.position.lerp(homePos, 0.09);
      c.target.lerp(base, 0.12);
      c.update();
      invalidate();
      if (
        c.object.position.distanceTo(homePos) < 0.05 &&
        c.target.distanceTo(base) < 0.05
      ) {
        resetting.current = false;
      }
      return;
    }

    // 注视点：转盘特写 / 取景基线与当前站的轻混合点（借 monopoly-3d 轻跟随）
    if (focus === 'spinner') {
      goal.current.copy(SPINNER_TARGET);
      returning.current = false;
    } else if (followStation !== null) {
      const a = stationAnchor(followStation);
      const mix = compact ? FOLLOW_MIX.compact : FOLLOW_MIX.desktop;
      goal.current.set(a.x * mix + base.x, 0, a.z * mix + base.z);
    } else {
      goal.current.copy(base);
    }

    const lerpK = focus === 'spinner' ? 0.1 : 0.05;
    const prev = c.target.distanceToSquared(goal.current);
    c.target.lerp(goal.current, lerpK);

    // 机位：推近转盘 / 落定缓回俯视；平时位置交给孩子（OrbitControls）
    let posMoving = false;
    const posGoal =
      focus === 'spinner' ? spinnerPos : returning.current ? homePos : null;
    if (posGoal) {
      c.object.position.lerp(posGoal, focus === 'spinner' ? 0.08 : 0.07);
      const d = c.object.position.distanceTo(posGoal);
      posMoving = d > 0.08;
      if (!posMoving && returning.current) returning.current = false;
    }

    c.update();
    if (prev > 0.0004 || posMoving) invalidate(); // 还在动就继续渲染，停住不耗帧
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minPolarAngle={0.62}
      maxPolarAngle={1.05}
      minDistance={12}
      maxDistance={Math.max(40, fitD * 1.2)}
      onStart={() => {
        interacted.current = true;
        resetting.current = false;
        returning.current = false; // 孩子自己拖了就不打断
        onUserGesture?.();
      }}
    />
  );
}
