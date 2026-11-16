/**
 * CameraRig.tsx —— drei OrbitControls + 每帧 target.lerp 轻跟随当前棋子
 * （借 monopoly-3d CameraRig 的写法：limit 俯角/远近 + 阻尼）。
 * 焦点模式借 closing-quest：auto（总览/跟当前站）/ spinner（转盘推近特写，
 * 落定后缓回俯视）；resetKey 变化时平滑回默认视角（DOM「回默认视角」按钮）。
 * 孩子一上手拖动（onStart）就打断回位/推近，相机永远归孩子管。
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { stationAnchor } from './positions';

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
 * T5 fit-solved 取景（ART_3D §8.1「整座岛都在画面里」，借参考桌游的
 * fit-solve 做法）：不再用经验倍率猜距离，而是把小岛包围盒的 8 个角
 * （浅滩沿外廓 ±8.55×±6.65、含 rim 树高 1.7）投影到 NDC，沿默认机位
 * 方向二分求出「任一跟随目标下、所有角都落进可用画幅」的最小距离。
 * 可用画幅按 DOM 浮层内缩：桌面左右 bot 列 + 顶条 + 底栏；手机横屏
 * 画布已被竖栏切走，只再让顶部头像排与底部圆钮。
 */
const FIT_BOUNDS = { x: 8.55, z: 6.65, top: 1.7 };
const FIT_RECT = {
  // 桌面：UI 迭代 R4 起布局撑满整屏高（layout.css min-width:901px），
  // 底部是「提示条 + 底栏」固定高度的底部栈：壳下 padding 16 + 底栏 81
  // + 行间隙 8 + 条下偏移 8 + 条高 76 ≈ 189px（800px 高折算 0.236，
  // 取 b 0.24）—— 整岛落在顶部条（72px → t 0.10，含间隙）与底部栈
  // 之间的自由带内，条/栏不再压岛。带日志行时条高 104、栈 217px，
  // 外廓（浅滩沿）底缘会与条顶轻碰约 25px，草地/路面核心仍在条上方
  // （R4 实测核验）。左右仍 10%（bot 列之间）。
  // R5：配合 FIT_SHIFT.z 把岛在带内纵向摆正、FOLLOW_MIX 收小 → 岛在
  // 默认取景几乎填满自由带（目标 60–70%，见 ART_R5.md）。
  // R5 修正（PM，2026-11-17）：初版按 b 0.24 求解后实测 rim 填充
  // 0.87（求解器 FIT_BOUNDS 投影 ÷ 自由带；截图沙沿 0.73、均超 0.70
  // 上限），故把桌面 FIT_RECT 收至 {0.145, 0.145, 0.145, 0.285}——
  // 仍由求解器二分求距（无经验倍率，F5 机制不变），求解器预测 rim
  // 填充 0.66（740×419，自由带 868×539），落回 60–70% 带中部；
  // 拟合框（x 179–1101、y 112–576）仍贴合自由带，求解后 rim
  // （x 270–1010、y 132–551）与各面板留有余量，A4 0% 遮挡不受影响。
  // 手机档（compact）实测 rim 0.665 已达标，不动。
  desktop: { l: 0.145, r: 0.145, t: 0.145, b: 0.285 },
  // UI 迭代 R2：手机横屏让位收窄 —— 顶部头像排下沿实测在 56px
  // （= 402 的 13.9%），t 0.16 → 0.14 正好贴合；左 0.03。
  // R5：实测画布其实是 874 全宽（.board3d 的 right:rail-w 被 width:100%
  // 顶掉），右竖栏只是 DOM 浮层——r 0.03 → 0.30 把 262px 栏位建进取景，
  // 岛不再往栏下长；b 0.14 → 0.16 对齐左下/右下圆钮区（y338）。
  compact: { l: 0.03, r: 0.3, t: 0.14, b: 0.16 },
} as const;

/**
 * R5 取景基线偏移（world units，加在 DEFAULT_TARGET 上）：
 * - 桌面 z+1.5：镜头注视点向「镜头前」挪 → 岛在自由带内不再贴底，
 *   垂直方向居中 → 求解机位更近、岛几乎撑满带高。
 * - 手机 x+3.2：画布 874 全宽、右竖栏遮 x612+，注视点右移 → 岛像
 *   在 0–612 自由区里居中（投影中心 ≈x306，而非画布中心 437）。
 * 偏移同时作用于默认目标、全部跟随目标与回正目标，保持观感一致。
 */
const FIT_SHIFT = {
  desktop: { x: 0, z: 1.5 },
  compact: { x: 3.2, z: 0.4 },
} as const;

/**
 * R5 跟随幅度（目标点向当前站锚点的混合比）：0.45/0.72 → 0.12/0.05。
 * 取景目标是「小岛占自由带 60–70%」——跟随越多，所有跟随位都满足
 * 约束所需的机位越远、岛越小；收小后镜头仍平滑移向当前棋子，
 * 但岛几乎不滑出带（对小孩也稳）。配合 FIT_SHIFT 摆位。
 */
const FOLLOW_MIX = { desktop: 0.12, compact: 0.05 } as const;

/** 取景基线（默认/跟随目标的公共原点） */
function fitBase(compact: boolean): THREE.Vector3 {
  const s = compact ? FIT_SHIFT.compact : FIT_SHIFT.desktop;
  return new THREE.Vector3(s.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z + s.z);
}

function fitDistance(aspect: number, compact: boolean): number {
  const rect = compact ? FIT_RECT.compact : FIT_RECT.desktop;
  const minX = -1 + 2 * rect.l;
  const maxX = 1 - 2 * rect.r;
  const minY = -1 + 2 * rect.b;
  const maxY = 1 - 2 * rect.t;
  const dir = DEFAULT_POS.clone().normalize();
  const cam = new THREE.PerspectiveCamera(27, Math.max(0.5, aspect), 0.5, 400);
  const mix = compact ? FOLLOW_MIX.compact : FOLLOW_MIX.desktop;
  const base = fitBase(compact);
  const goals: THREE.Vector3[] = [base.clone()];
  for (let i = 0; i < 8; i++) {
    const a = stationAnchor(i);
    goals.push(new THREE.Vector3(a.x * mix + base.x, 0, a.z * mix + base.z));
  }
  const corners: THREE.Vector3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, 0, sz * FIT_BOUNDS.z));
      corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, FIT_BOUNDS.top, sz * FIT_BOUNDS.z));
    }
  const v = new THREE.Vector3();
  const fits = (d: number): boolean => {
    cam.position.copy(base).addScaledVector(dir, d);
    for (const g of goals) {
      cam.lookAt(g);
      cam.updateMatrixWorld();
      for (const c of corners) {
        v.copy(c).project(cam);
        if (v.x < minX || v.x > maxX || v.y < minY || v.y > maxY) return false;
      }
    }
    return true;
  };
  let lo = 14;
  let hi = 90;
  if (!fits(hi)) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
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

  // T5：home 距离由 fit-solve 按当前画幅/档位求出（见 fitDistance）；
  // 转盘推近距离按同一比例缩放，保持推近的相对幅度
  const aspect = size.width / Math.max(1, size.height);
  const fitD = fitDistance(aspect, compact);
  const base = fitBase(compact);
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
