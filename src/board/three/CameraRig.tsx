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
  // （R4 实测核验）。离线复刻求解：距离 39.9 → 52.9（fog 60 起，
  // 远沿约 62、起雾约 3%，可忽略）；b 0.29+ 时距离 67+ 撞雾，不可取。
  // 左右仍 10%（bot 列之间）。
  desktop: { l: 0.1, r: 0.1, t: 0.1, b: 0.24 },
  // UI 迭代 R2：手机横屏让位收窄 —— 顶部头像排下沿实测在 56px
  // （= 402 的 13.9%），t 0.16 → 0.14 正好贴合；左右 0.04 → 0.03。
  // 底部 fabs 区（56px 高 + 8px 边距）仍由 b 0.14（56px）+ 画布外
  // 的竖栏切分共同让位，不动。纵向可用画幅 70% → 72%。
  compact: { l: 0.03, r: 0.03, t: 0.14, b: 0.14 },
} as const;

function fitDistance(aspect: number, compact: boolean): number {
  const rect = compact ? FIT_RECT.compact : FIT_RECT.desktop;
  const minX = -1 + 2 * rect.l;
  const maxX = 1 - 2 * rect.r;
  const minY = -1 + 2 * rect.b;
  const maxY = 1 - 2 * rect.t;
  const dir = DEFAULT_POS.clone().normalize();
  const cam = new THREE.PerspectiveCamera(27, Math.max(0.5, aspect), 0.5, 400);
  const mix = compact ? 0.72 : 0.45;
  const goals: THREE.Vector3[] = [DEFAULT_TARGET.clone()];
  for (let i = 0; i < 8; i++) {
    const a = stationAnchor(i);
    goals.push(new THREE.Vector3(a.x * mix, 0, a.z * mix + 0.4));
  }
  const corners: THREE.Vector3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, 0, sz * FIT_BOUNDS.z));
      corners.push(new THREE.Vector3(sx * FIT_BOUNDS.x, FIT_BOUNDS.top, sz * FIT_BOUNDS.z));
    }
  const v = new THREE.Vector3();
  const fits = (d: number): boolean => {
    cam.position.copy(DEFAULT_TARGET).addScaledVector(dir, d);
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
  const homePos = DEFAULT_TARGET.clone()
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
      c.target.lerp(DEFAULT_TARGET, 0.12);
      c.update();
      invalidate();
      if (
        c.object.position.distanceTo(homePos) < 0.05 &&
        c.target.distanceTo(DEFAULT_TARGET) < 0.05
      ) {
        resetting.current = false;
      }
      return;
    }

    // 注视点：转盘特写 / 岛心与当前站的 45% 混合点（借 monopoly-3d 轻跟随）
    if (focus === 'spinner') {
      goal.current.copy(SPINNER_TARGET);
      returning.current = false;
    } else if (followStation !== null) {
      const a = stationAnchor(followStation);
      const mix = compact ? 0.72 : 0.45;
      goal.current.set(a.x * mix, 0, a.z * mix + 0.4);
    } else {
      goal.current.copy(DEFAULT_TARGET);
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
