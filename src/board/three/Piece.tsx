/**
 * Piece.tsx —— 棋子（M4.5.2）：Kenney Mini 角色 GLB，身体染玩家色、脸保留原样；
 * 头顶玩家色徽章（emoji 图标，canvas 贴图 + Billboard 永远面向镜头）。
 * 走站（stationIndex 变化）：4 枚按座位序错峰 ~0.12s 沿弧线跳过去，
 * 空中微拉长、落地压扁回弹 + 一圈小星星尘土（借 monopoly-3d 逐站小跳思路，
 * 按项目约定手写 useFrame 插值，不用 gsap）。prefers-reduced-motion 直接落位。
 * 当前行动者：轻轻上下晃 + 玩家色光环加亮，让孩子始终找得到「轮到谁」。
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import type { BoardPawn } from '../BoardView';
import { hopPose, pawnAnchor } from './positions';
import { fastMode } from './ambient';
import { PALETTE, pawnColor, blobShadowTexture } from './materials';
import { setShadows, tintMeshes, upgradeToPlastic } from './gltf';

const BASE_Y = 0.3; // 地砖顶面高度（0.16 + 半厚 0.12 + 一点点）
const HOP_DUR = 0.52; // 单站弧跳时长（秒）
const STAGGER = 0.12; // 4 枚错峰
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 玩家色 → Kenney 角色（4 个不同小人，待确认，ART_3D §3） */
const PAWN_MODEL: Record<string, string> = {
  'var(--player-you)': 'character-female-a.glb',
  'var(--player-steady)': 'character-male-a.glb',
  'var(--player-impulsive)': 'character-female-c.glb',
  'var(--player-follower)': 'character-male-b.glb',
};

/** 头顶徽章：奶油圆牌 + 玩家色描边 + emoji 图标（与 2D 头像一致） */
function iconTexture(icon: string, ring: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fillStyle = '#FFFDF6';
  g.fill();
  g.lineWidth = 11;
  g.strokeStyle = ring;
  g.stroke();
  g.font = '58px "Noto Color Emoji", "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(icon, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function Character({ url, color, slot, shadows }: { url: string; color: string; slot: number; shadows: boolean }) {
  const { scene, animations } = useGLTF(url);
  const model = useMemo(() => {
    upgradeToPlastic(scene); // 源场景幂等塑料化（克隆共享材质）
    const m = SkeletonUtils.clone(scene) as THREE.Group;
    tintMeshes(m, color, ['body-mesh']); // 穿玩家色外套，脸保留
    setShadows(m, shadows);
    // 采一帧 idle 姿态（手臂放下），不持续播动画——frameloop=demand 不空耗帧
    const idle = animations.find((a) => a.name === 'idle');
    if (idle) {
      const mixer = new THREE.AnimationMixer(m);
      mixer.clipAction(idle).play();
      mixer.update(0.02 + slot * 0.17); // 只采一帧定格，不再推进
    }
    return m;
  }, [scene, animations, color, shadows, slot]);
  return <primitive object={model} />;
}

/** 彩纸方向（凑齐菜时撒一圈）：每片随机但稳定的出射向量 */
const CONFETTI_DIRS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.35;
  return {
    dir: new THREE.Vector3(Math.cos(a) * 0.5, 1.5 + (i % 4) * 0.25, Math.sin(a) * 0.5),
    spin: (i % 2 === 0 ? 1 : -1) * (2 + (i % 5)),
  };
});
const CONFETTI_DUR = 0.95;
const CONFETTI_COLORS = [PALETTE.orange, PALETTE.yellow, PALETTE.blue, PALETTE.mint, PALETTE.purple];

export function Piece({
  pawn,
  stationIndex,
  slot,
  active,
  shadows,
}: {
  pawn: BoardPawn;
  stationIndex: number;
  slot: number;
  active: boolean;
  shadows: boolean;
}) {
  const color = pawnColor(pawn.colorVar);
  const url = `./models/${PAWN_MODEL[pawn.colorVar] ?? 'character-female-a.glb'}`;
  const icon = useMemo(() => iconTexture(pawn.icon, color), [pawn.icon, color]);
  const blob = useMemo(() => blobShadowTexture(), []);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const fx = useRef<THREE.Group>(null);
  const confetti = useRef<THREE.Group>(null);
  const prevIdx = useRef(stationIndex);
  const hop = useRef<{ from: { x: number; z: number }; to: { x: number; z: number }; start: number } | null>(null);
  const fxMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FFC93C', transparent: true, opacity: 0, depthWrite: false }),
    [],
  );
  const confettiMats = useMemo(
    () =>
      CONFETTI_DIRS.map(
        (_, i) =>
          new THREE.MeshBasicMaterial({
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
      ),
    [],
  );
  const confettiPieces = useRef<(THREE.Mesh | null)[]>([]);
  // 菜谱进度边缘检测：done 涨到 total → 撒一小把彩纸（ART_3D §8.5）
  const prevDone = useRef(pawn.recipe?.done ?? 0);
  const cheer = useRef(0); // 彩纸开演时刻（clock 秒），0 = 未演

  useFrame(({ clock, invalidate }) => {
    const now = clock.elapsedTime;
    const g = root.current;
    if (!g) return;

    // 凑齐一道菜 → 撒彩纸（从 done 涨到 total 的那一帧起 ~1s）
    const done = pawn.recipe?.done ?? 0;
    const total = pawn.recipe?.total ?? 0;
    if (done > prevDone.current && total > 0 && done >= total && !reduced) {
      cheer.current = now;
      if (confetti.current) confetti.current.visible = true;
    }
    prevDone.current = done;
    if (cheer.current > 0) {
      const k = (now - cheer.current) / CONFETTI_DUR;
      if (k >= 1) {
        cheer.current = 0;
        if (confetti.current) confetti.current.visible = false;
      } else {
        CONFETTI_DIRS.forEach((d, i) => {
          const m = confettiPieces.current[i];
          if (!m) return;
          m.position.set(
            d.dir.x * k * 1.1,
            0.55 + d.dir.y * k - 1.6 * k * k, // 抛起后回落
            d.dir.z * k * 1.1,
          );
          m.rotation.set(d.spin * k * 3, d.spin * k * 2, 0);
          confettiMats[i].opacity = k < 0.7 ? 1 : (1 - k) / 0.3;
        });
        invalidate();
      }
    }

    // 站点变化 → 以当前位置为起点开新一段弧跳（错峰 start 在未来的帧自然等待）
    if (prevIdx.current !== stationIndex) {
      hop.current = {
        from: { x: g.position.x, z: g.position.z },
        to: pawnAnchor(stationIndex, slot),
        start: now + slot * STAGGER,
      };
      prevIdx.current = stationIndex;
      fxMat.opacity = 0;
    }

    const h = hop.current;
    if (h && !reduced) {
      const k = (now - h.start) / HOP_DUR;
      if (k < 0) {
        invalidate(); // 等自己的拍子
      } else if (k <= 1.05) {
        const kk = Math.min(1, k);
        const p = hopPose(h.from, h.to, kk);
        g.position.set(p.x, BASE_Y + p.y, p.z);
        g.rotation.y = p.yaw * 0.55; // 朝行进方向微侧，落地后再回正
        if (k > 1) g.rotation.y *= 1 - (k - 1) / 0.05;
        body.current?.scale.set(p.scaleXZ * 1.12, p.scaleY * 1.12, p.scaleXZ * 1.12);
        // 落地星尘圈
        if (kk > 0.7 && fx.current) {
          const f = (kk - 0.7) / 0.3;
          fxMat.opacity = (1 - f) * 0.85;
          fx.current.scale.setScalar(0.35 + f * 1.1);
          fx.current.visible = true;
        }
        invalidate();
      } else {
        hop.current = null;
        g.rotation.y = 0;
        fx.current && (fx.current.visible = false);
      }
    } else {
      const a = pawnAnchor(stationIndex, slot);
      g.position.set(a.x, BASE_Y, a.z);
      body.current?.scale.set(1.12, 1.12, 1.12);
      // 当前行动者轻轻上下晃（持续 invalidate 保持呼吸感）；
      // ?fast=1 冻结（见 ambient.fastMode，软渲染下防持续 invalidate 钉死主线程）
      if (active && !reduced && !fastMode && body.current) {
        body.current.position.y = Math.abs(Math.sin(now * 3.2)) * 0.09;
        invalidate();
      } else if (body.current) {
        body.current.position.y = 0;
      }
    }
  });

  return (
    <group ref={root} position={[pawnAnchor(stationIndex, slot).x, BASE_Y, pawnAnchor(stationIndex, slot).z]}>
      <group ref={body} scale={1.12}>
        <Character url={url} color={color} slot={slot} shadows={shadows} />
        {/* 头顶徽章：永远面向镜头的小圆牌 */}
        <Billboard position={[0, 1.28, 0]}>
          <mesh>
            <planeGeometry args={[0.46, 0.46]} />
            <meshBasicMaterial map={icon} transparent depthWrite={false} />
          </mesh>
        </Billboard>
      </group>

      {/* 落地星尘：一圈小星星 + 扩散环（默认隐藏，落地瞬间亮出） */}
      <group ref={fx} visible={false} position-y={0.03}>
        {[
          [0.34, 0.1, 0],
          [-0.3, 0.16, 0.18],
          [0.1, 0.22, -0.32],
          [-0.16, 0.08, -0.3],
          [0.26, 0.18, 0.3],
        ].map((p, i) => (
          <mesh key={i} position={[p[0], p[1], p[2]]} material={fxMat}>
            <octahedronGeometry args={[0.055]} />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position-y={0.01} material={fxMat}>
          <ringGeometry args={[0.34, 0.46, 28]} />
        </mesh>
      </group>

      {/* 玩家色光环（始终脚下；active 更亮更宽） */}
      <mesh position-y={-BASE_Y + 0.315} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[active ? 0.27 : 0.21, active ? 0.38 : 0.29, 28]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.95 : 0.4} />
      </mesh>

      {/* 低档贴片影：无实时阴影时给棋子一个柔和落点 */}
      {!shadows && (
        <mesh position-y={-BASE_Y + 0.305} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.85, 0.85]} />
          <meshBasicMaterial map={blob} transparent depthWrite={false} />
        </mesh>
      )}

      {/* 凑齐菜的彩纸：默认隐藏，done→total 瞬间撒一圈 */}
      <group ref={confetti} visible={false} position-y={0.4}>
        {CONFETTI_DIRS.map((_, i) => (
          <mesh
            key={i}
            ref={(m) => {
              confettiPieces.current[i] = m;
            }}
            material={confettiMats[i]}
          >
            <planeGeometry args={[0.09, 0.13]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
