/**
 * CoinFly.tsx —— 钱的反馈（ART_3D §8.5）：花/得币时 3 枚金币沿小弧线
 * 在「行动的棋子 ↔ 当前站道具」之间飞一段（≤0.8s，错 0.07s 起飞）。
 * 触发信号是 board.fx.nonce（boardModel 从流水派生，同一笔只播一次）；
 * prefers-reduced-motion 直接不播。
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { BoardViewProps } from '../BoardView';
import { pawnAnchor, propAnchor } from './positions';
import { PALETTE } from './materials';
import { reducedMotion } from './ambient';

const COUNT = 3;
const DUR = 0.75;
const STAGGER = 0.07;

export function CoinFly({
  fx,
  stationIndex,
  pawns,
}: {
  fx: BoardViewProps['fx'];
  stationIndex: number;
  pawns: BoardViewProps['pawns'];
}) {
  const coins = useRef<(THREE.Group | null)[]>([]);
  const anim = useRef<{
    nonce: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    t0: number;
  } | null>(null);
  const mats = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        face: new THREE.MeshStandardMaterial({
          color: PALETTE.yellow,
          roughness: 0.5,
          metalness: 0.2,
          transparent: true,
        }),
        edge: new THREE.MeshStandardMaterial({
          color: PALETTE.orange,
          roughness: 0.6,
          metalness: 0,
          transparent: true,
        }),
      })),
    [],
  );

  useFrame(({ clock, invalidate }) => {
    const now = clock.elapsedTime;

    // 新一笔得失币 → 开演（同一 nonce 不重复播）
    if (fx && !reducedMotion && anim.current?.nonce !== fx.nonce) {
      const slot = Math.max(
        0,
        pawns.findIndex((p) => p.playerId === fx.playerId),
      );
      const paw = pawnAnchor(stationIndex, slot);
      const prop = propAnchor(stationIndex, 0.95);
      const a = new THREE.Vector3(paw.x, 0.75, paw.z);
      const b = new THREE.Vector3(prop.x, 0.9, prop.z);
      anim.current = {
        nonce: fx.nonce,
        from: fx.kind === 'gain' ? b : a, // 得币：站点 → 棋子；花币：棋子 → 站点
        to: fx.kind === 'gain' ? a : b,
        t0: now,
      };
    }

    const an = anim.current;
    if (!an) return;
    let alive = false;
    for (let i = 0; i < COUNT; i++) {
      const c = coins.current[i];
      if (!c) continue;
      const k = (now - an.t0 - i * STAGGER) / DUR;
      if (k < 0) {
        alive = true;
        continue;
      }
      if (k >= 1) {
        c.visible = false;
        continue;
      }
      alive = true;
      const e = k * k * (3 - 2 * k);
      const lift = Math.sin(Math.PI * k) * 1.4; // 小弧线
      c.position.set(
        an.from.x + (an.to.x - an.from.x) * e,
        an.from.y + (an.to.y - an.from.y) * e + lift,
        an.from.z + (an.to.z - an.from.z) * e,
      );
      c.rotation.y += 0.28; // 翻滚
      const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
      mats[i].face.opacity = fade;
      mats[i].edge.opacity = fade;
      c.visible = true;
    }
    if (!alive) {
      anim.current = null;
      return;
    }
    invalidate();
  });

  return (
    <group>
      {Array.from({ length: COUNT }, (_, i) => (
        <group
          key={i}
          ref={(g) => {
            coins.current[i] = g;
          }}
          visible={false}
        >
          {/* 金币：圆片 + 稍深的边 */}
          <mesh rotation-x={Math.PI / 2} material={mats[i].face}>
            <cylinderGeometry args={[0.13, 0.13, 0.035, 20]} />
          </mesh>
          <mesh rotation-x={Math.PI / 2} material={mats[i].edge}>
            <torusGeometry args={[0.13, 0.028, 8, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
