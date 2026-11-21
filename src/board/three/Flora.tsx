/**
 * Flora.tsx —— 地面花草灌木栅栏撒布（M4.5.7 织梦岛风，ART_3D §9.7：
 * 「地面上点缀花丛、灌木、栅栏、石头，不留大片空白」，每两站之间 3–6 件）。
 * 全部 InstancedMesh 实例化：花头（亮黄/粉/蓝三色）+ 花茎 + 灌木球 + 石头
 * + 栅栏段（只在伙伴站与家门口点缀几段），实例化几百棵也不卡（§10）。
 * 位置由固定种子序列在相邻站间草地带取点（mulberry32，可复现），
 * 剔除与转盘（岛心 r<2.9）、站点地砖、道具锚点、岛缘树石重叠的点；
 * 密度由画质档缩放（high ×1.0 / medium ×0.6 / low ×0.4），
 * 每站段内按等距取舍（减密度 = 均匀抽稀，不整体重摆）。
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { loopPoint, propAnchor, stationAnchor, stationT } from './positions';
import { FLOWER_COLORS, PLASTIC, SCENE } from './materials';

/** mulberry32 固定种子：撒布可复现，不依赖引擎 rng */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 草地可用范围：岛 15.2×11.4 收一圈安全边（圆角近似） */
function insideIsland(x: number, z: number): boolean {
  const hx = 6.5;
  const hz = 4.7;
  const r = 1.7;
  const qx = Math.abs(x);
  const qz = Math.abs(z);
  if (qx > hx || qz > hz) return false;
  const cx = Math.max(0, qx - (hx - r));
  const cz = Math.max(0, qz - (hz - r));
  return cx * cx + cz * cz <= r * r;
}

/** 不撒的点：岛缘树石（Scene.tsx 静态点缀） */
const KEEP_OUT = [
  { x: -6.7, z: -4.4, r: 1.1 },
  { x: 6.8, z: -4.6, r: 1.0 },
  { x: -6.6, z: 4.6, r: 1.05 },
  { x: 6.7, z: 4.5, r: 1.15 },
  { x: -5.9, z: 5.0, r: 0.6 },
  { x: 6.1, z: -5.0, r: 0.55 },
];

type FloraKind = 'flower' | 'bush' | 'stone';
interface FloraItem {
  kind: FloraKind;
  x: number;
  z: number;
  rot: number;
  s: number;
  ci: number; // 颜色序号
}

/** 站间草地带撒布（density∈[0,1]：段内等距取舍 = 均匀抽稀不重摆） */
function scatter(density: number): FloraItem[] {
  const rng = mulberry32(20261115);
  const items: FloraItem[] = [];
  for (let i = 0; i < 8; i++) {
    const t0 = stationT(i);
    const t1 = stationT((i + 1) % 8);
    const gap = t1 > t0 ? t1 - t0 : t1 + 1 - t0;
    // T6 密度：候选池加倍撒点，过滤后每段最多保留 6 件（ART §9.7 上限），
    // 保证每段过滤完仍有 3–6 件，不再出现大片空白草地
    const n = Math.min(14, Math.max(7, Math.round((gap * 30) / 0.7)));
    const a = stationAnchor(i);
    const prop = propAnchor(i, i === 1 ? 1.08 : 0.98); // 道具锚点（菜市场更大）
    const cands: FloraItem[] = [];
    for (let k = 0; k < n; k++) {
      const frac = (k + 0.5) / n + (rng() - 0.5) * 0.14;
      const p = loopPoint(t0 + gap * frac);
      const len = Math.hypot(p.x, p.z) || 1;
      const side = rng() < 0.58 ? 1 : -1; // 略偏向街外侧（内侧让位转盘）
      const dist = 0.95 + rng() * 0.8; // T6：撒布带略放宽，内侧草地也填上
      const x = p.x + (p.x / len) * side * dist;
      const z = p.z + (p.z / len) * side * dist;
      const blocked =
        Math.hypot(x, z) < 2.9 || // 中央转盘
        !insideIsland(x, z) ||
        Math.hypot(x - a.x, z - a.z) < (i === 1 ? 1.7 : 1.25) || // 站点地砖
        Math.hypot(x - prop.x, z - prop.z) < (i === 1 ? 1.6 : 1.05) || // 站道具
        KEEP_OUT.some((k2) => Math.hypot(x - k2.x, z - k2.z) < k2.r);
      if (blocked) continue;
      const roll = rng();
      cands.push({
        kind: roll < 0.62 ? 'flower' : roll < 0.84 ? 'bush' : 'stone',
        x,
        z,
        rot: rng() * Math.PI * 2,
        s: 0.8 + rng() * 0.5,
        ci: Math.floor(rng() * 3),
      });
    }
    const kept = cands.slice(0, 6); // ART §9.7：每两站之间 3–6 件
    const m = Math.max(1, Math.round(kept.length * density));
    for (let j = 0; j < m && kept.length > 0; j++) {
      items.push(kept[Math.floor((j * kept.length) / m)]);
    }
  }
  return items;
}

/** opt/visual V1：中央草坪四角花坛——转盘禁区（r<2.9）与环路内缘
 *  之间的四个角落口袋各一丛（8 花 + 1 灌木），让岛心不再空着一整块
 *  平绿；密度按画质档抽稀（每坛至少留 3 件）。中心由 scatter 的
 *  rng 续取，保证全场撒布仍可复现。 */
const BEDS = [
  { x: 3.6, z: 2.0 },
  { x: -3.6, z: 2.0 },
  { x: 3.6, z: -2.0 },
  { x: -3.6, z: -2.0 },
];

function bedItems(density: number): FloraItem[] {
  const rng = mulberry32(20261120);
  const items: FloraItem[] = [];
  for (const bed of BEDS) {
    const cands: FloraItem[] = [];
    for (let k = 0; k < 8; k++) {
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * 0.48;
      cands.push({
        kind: 'flower',
        x: bed.x + Math.cos(a) * rr,
        z: bed.z + Math.sin(a) * rr * 0.8,
        rot: rng() * Math.PI * 2,
        s: 0.9 + rng() * 0.4,
        ci: Math.floor(rng() * 3),
      });
    }
    cands.push({
      kind: 'bush',
      x: bed.x + (bed.x > 0 ? 0.55 : -0.55),
      z: bed.z - 0.3,
      rot: rng() * Math.PI * 2,
      s: 0.85,
      ci: 0,
    });
    const m = Math.max(3, Math.round(cands.length * density));
    for (let j = 0; j < m; j++) items.push(cands[Math.floor((j * cands.length) / m)]);
  }
  return items;
}

/** 栅栏段：只点缀在伙伴站（③ index 2）与家门口（⑧ index 7）旁，两站各两段 */
const FENCES = [2, 7].flatMap((si) =>
  [-0.55, 0.55].map((off, di) => {
    const p = propAnchor(si, 1.7); // 道具再外侧一点
    const t = loopPoint(stationT(si));
    // 顺路切向偏移，别正压在道具上
    const tx = Math.cos(t.yaw);
    const tz = Math.sin(t.yaw);
    return { x: p.x + tx * off, z: p.z + tz * off, yaw: -t.yaw, key: `${si}-${di}` };
  }),
);

/** 批量实例写入：matrices + 可选逐实例颜色 */
function useInstances(
  ref: React.RefObject<THREE.InstancedMesh | null>,
  mats: THREE.Matrix4[],
  colors?: THREE.Color[],
) {
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    mats.forEach((mat, i) => m.setMatrixAt(i, mat));
    if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.count = mats.length;
    invalidate();
  }, [ref, mats, colors, invalidate]);
}

export function Flora({ density, shadows }: { density: number; shadows: boolean }) {
  const items = useMemo(() => [...scatter(density), ...bedItems(density)], [density]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { flowers, bushes, stones } = useMemo(
    () => ({
      flowers: items.filter((it) => it.kind === 'flower'),
      bushes: items.filter((it) => it.kind === 'bush'),
      stones: items.filter((it) => it.kind === 'stone'),
    }),
    [items],
  );

  const matsOf = (list: FloraItem[], y: number, squash = 1) =>
    list.map((it) => {
      dummy.position.set(it.x, y * it.s, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(it.s, it.s * squash, it.s);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });

  const flowerHeadRef = useRef<THREE.InstancedMesh>(null);
  const flowerStemRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const stoneRef = useRef<THREE.InstancedMesh>(null);
  const postRef = useRef<THREE.InstancedMesh>(null);
  const railRef = useRef<THREE.InstancedMesh>(null);

  const headMats = useMemo(() => matsOf(flowers, 0.13), [flowers, dummy]);
  const stemMats = useMemo(() => matsOf(flowers, 0.055), [flowers, dummy]);
  const bushMats = useMemo(() => matsOf(bushes, 0.13, 0.72), [bushes, dummy]);
  const stoneMats = useMemo(
    () =>
      stones.map((it) => {
        dummy.position.set(it.x, 0.08 * it.s, it.z);
        dummy.rotation.set(it.rot * 0.3, it.rot, it.rot * 0.17);
        dummy.scale.setScalar(it.s);
        dummy.updateMatrix();
        return dummy.matrix.clone();
      }),
    [stones, dummy],
  );

  const headColors = useMemo(
    () => flowers.map((it) => new THREE.Color(FLOWER_COLORS[it.ci % 3])),
    [flowers],
  );
  const bushColors = useMemo(
    () => bushes.map((_, i) => new THREE.Color(i % 2 ? SCENE.bushDark : SCENE.bush)),
    [bushes],
  );

  const { postMats, railMats } = useMemo(() => {
    const posts: THREE.Matrix4[] = [];
    const rails: THREE.Matrix4[] = [];
    for (const f of FENCES) {
      const c = Math.cos(f.yaw);
      const s = Math.sin(f.yaw);
      for (const off of [-0.32, 0.32]) {
        dummy.position.set(f.x + c * off, 0.16, f.z - s * off);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        posts.push(dummy.matrix.clone());
      }
      dummy.position.set(f.x, 0.22, f.z);
      dummy.rotation.set(0, f.yaw, 0);
      dummy.updateMatrix();
      rails.push(dummy.matrix.clone());
    }
    return { postMats: posts, railMats: rails };
  }, [dummy]);

  useInstances(flowerHeadRef, headMats, headColors);
  useInstances(flowerStemRef, stemMats);
  useInstances(bushRef, bushMats, bushColors);
  useInstances(stoneRef, stoneMats);
  useInstances(postRef, postMats);
  useInstances(railRef, railMats);

  return (
    <group>
      {/* 花：茎 + 三色花头（ART §9.7 亮黄/粉/蓝） */}
      <instancedMesh ref={flowerStemRef} args={[undefined, undefined, stemMats.length]}>
        <cylinderGeometry args={[0.02, 0.026, 0.12, 6]} />
        <meshPhysicalMaterial color={SCENE.bushDark} {...PLASTIC} />
      </instancedMesh>
      <instancedMesh
        ref={flowerHeadRef}
        args={[undefined, undefined, headMats.length]}
        castShadow={shadows}
      >
        <sphereGeometry args={[0.095, 10, 8]} />
        <meshPhysicalMaterial color="#FFFFFF" {...PLASTIC} />
      </instancedMesh>
      {/* 灌木：压扁球丛（比草深两档绿） */}
      <instancedMesh
        ref={bushRef}
        args={[undefined, undefined, bushMats.length]}
        castShadow={shadows}
      >
        <sphereGeometry args={[0.26, 12, 9]} />
        <meshPhysicalMaterial color="#FFFFFF" {...PLASTIC} />
      </instancedMesh>
      {/* 石头 */}
      <instancedMesh
        ref={stoneRef}
        args={[undefined, undefined, stoneMats.length]}
        castShadow={shadows}
      >
        <dodecahedronGeometry args={[0.13, 0]} />
        <meshPhysicalMaterial color={SCENE.stone} {...PLASTIC} />
      </instancedMesh>
      {/* 栅栏：短柱 + 横杆（伙伴站/家门口各两段） */}
      <instancedMesh
        ref={postRef}
        args={[undefined, undefined, postMats.length]}
        castShadow={shadows}
      >
        <cylinderGeometry args={[0.035, 0.045, 0.32, 8]} />
        <meshPhysicalMaterial color={SCENE.wood} {...PLASTIC} />
      </instancedMesh>
      <instancedMesh
        ref={railRef}
        args={[undefined, undefined, railMats.length]}
        castShadow={shadows}
      >
        <boxGeometry args={[0.72, 0.055, 0.045]} />
        <meshPhysicalMaterial color={SCENE.wood} {...PLASTIC} />
      </instancedMesh>
    </group>
  );
}
