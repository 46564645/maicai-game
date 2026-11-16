/**
 * StationProps.tsx —— 8 站道具（ART_3D §1）：摆在站点「街外侧」草地上、面向街道，
 * 菜市场体量最大最显眼。Mini Shop / Food Kit GLB + 同风格程序化几何体混拼，
 * 缺口（公交站牌/小面包车/大手机/小房子/棚子）一律程序化，不混第三套画风。
 * 场景内不放文字。
 */
import { useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { BoardStation } from '../BoardView';
import { propAnchor } from './positions';
import { PALETTE, PLASTIC, SCENE, blobShadowTexture } from './materials';
import { Model } from './gltf';
import { useAmbient } from './ambient';

type V3 = [number, number, number];

/** 圆角积木块（道具主力） */
function B({
  args,
  p,
  c,
  r = 0.06,
  ry = 0,
  rx = 0,
}: {
  args: V3;
  p: V3;
  c: string;
  r?: number;
  ry?: number;
  rx?: number;
}) {
  return (
    <RoundedBox
      args={args}
      radius={r}
      smoothness={3}
      position={p}
      rotation-y={ry}
      rotation-x={rx}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial color={c} {...PLASTIC} />
    </RoundedBox>
  );
}

function Pole({ p, h, c = SCENE.wood, r = 0.045 }: { p: V3; h: number; c?: string; r?: number }) {
  return (
    <mesh position={[p[0], p[1] + h / 2, p[2]]} castShadow>
      <cylinderGeometry args={[r, r * 1.15, h, 10]} />
      <meshPhysicalMaterial color={c} {...PLASTIC} />
    </mesh>
  );
}

/** 条纹棚顶：slatCount 根横条交替色，轻斜面向街道，轻轻随风飘（§8.6） */
function Awning({ w, d, y, colors }: { w: number; d: number; y: number; colors: [string, string] }) {
  const n = Math.max(3, Math.round(d / 0.3));
  const g = useRef<THREE.Group>(null);
  useAmbient(85, (t) => {
    if (g.current) g.current.rotation.x = 0.16 + Math.sin(t * 1.35 + w) * 0.028;
  });
  return (
    <group ref={g} position-y={y} rotation-x={0.16}>
      {Array.from({ length: n }, (_, i) => (
        <RoundedBox
          key={i}
          args={[w, 0.055, (d / n) * 1.06]}
          radius={0.025}
          smoothness={3}
          position={[0, Math.sin((i / (n - 1)) * Math.PI) * 0.03, -d / 2 + (i + 0.5) * (d / n)]}
          castShadow
        >
          <meshPhysicalMaterial color={colors[i % 2]} {...PLASTIC} />
        </RoundedBox>
      ))}
    </group>
  );
}

/** 棒棒糖树（Mini Forest 未下载，同风格程序化） */
function LollyTree({ p, s = 1 }: { p: V3; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position-y={0.42} castShadow>
        <cylinderGeometry args={[0.08, 0.11, 0.85, 10]} />
        <meshPhysicalMaterial color={SCENE.trunk} {...PLASTIC} />
      </mesh>
      <mesh position-y={1.05} castShadow>
        <sphereGeometry args={[0.48, 16, 12]} />
        <meshPhysicalMaterial color={SCENE.leaf} {...PLASTIC} />
      </mesh>
      <mesh position={[0.3, 0.78, 0.12]} castShadow>
        <sphereGeometry args={[0.26, 14, 10]} />
        <meshPhysicalMaterial color={SCENE.leaf} {...PLASTIC} />
      </mesh>
    </group>
  );
}

/* —— 各站道具（局部坐标：+z 朝街道） —— */

/** ① 抽任务卡：公告板 + 一摞卡 */
function DrawTaskProps() {
  return (
    <group>
      <Pole p={[-0.44, 0, 0]} h={0.9} />
      <Pole p={[0.44, 0, 0]} h={0.9} />
      <B args={[1.06, 0.62, 0.08]} p={[0, 0.72, 0]} c={SCENE.tileStation} />
      {(
        [
          [-0.3, PALETTE.purple],
          [-0.1, PALETTE.blue],
          [0.12, PALETTE.mint],
          [0.32, PALETTE.yellow],
        ] as [number, string][]
      ).map(([x, c], i) => (
        <B key={i} args={[0.17, 0.23, 0.02]} p={[x, 0.74, 0.055]} c={c} r={0.02} ry={(i - 1.5) * 0.06} />
      ))}
      {[0, 1, 2].map((i) => (
        <B key={`s${i}`} args={[0.3, 0.025, 0.4]} p={[0.72, 0.03 + i * 0.028, 0.3]} c={i === 2 ? PALETTE.purple : SCENE.tileStation} r={0.01} ry={0.2 - i * 0.18} />
      ))}
    </group>
  );
}

/** ② 菜市场：彩色布棚 + Mini Shop 货架 + Food Kit 食材（体量最大） */
function MarketProps() {
  return (
    <group>
      {([-1.06, 1.06] as const).map((x) =>
        ([-0.6, 0.6] as const).map((z) => <Pole key={`${x}${z}`} p={[x, 0, z]} h={1.42} />),
      )}
      <Awning w={2.5} d={1.5} y={1.44} colors={[PALETTE.orange, SCENE.tileStation]} />
      <Model path="display-fruit.glb" position={[-0.62, 0, 0.02]} scale={1.15} />
      <Model path="display-bread.glb" position={[0.62, 0, 0.02]} scale={1.15} />
      <Model path="display-small.glb" position={[0.95, 0, -0.4]} rotation-y={-0.35} />
      {/* 前柜台：散装食材 + 收银机 + 购物篮 */}
      <B args={[1.05, 0.4, 0.42]} p={[0, 0.2, 0.62]} c={SCENE.wood} />
      <Model path="tomato.glb" position={[-0.3, 0.4, 0.62]} scale={1.4} />
      <Model path="carrot.glb" position={[-0.05, 0.4, 0.66]} scale={0.55} />
      <Model path="fish.glb" position={[0.22, 0.4, 0.6]} scale={1.1} rotation-y={0.5} />
      <Model path="cash-register.glb" position={[0.72, 0, 0.55]} scale={0.6} rotation-y={-0.15} />
      <Model path="shopping-basket.glb" position={[-0.8, 0, 0.62]} scale={1.1} />
      <Model path="popsicle.glb" position={[1.06, 0.42, 0.62]} scale={0.9} rotation-z={0.35} />
      <Model path="ice-cream.glb" position={[-1.08, 0, 0.5]} scale={1.3} />
    </group>
  );
}

/** ③ 伙伴站：长椅 + 棒棒糖树 + 花 */
function PartnerProps() {
  return (
    <group>
      <B args={[0.95, 0.09, 0.36]} p={[0.1, 0.26, 0.1]} c={SCENE.wood} />
      <B args={[0.95, 0.4, 0.08]} p={[0.1, 0.5, -0.1]} c={SCENE.wood} rx={-0.14} />
      {([-0.25, 0.45] as const).map((x) => (
        <B key={x} args={[0.07, 0.24, 0.3]} p={[x, 0.11, 0.1]} c={SCENE.trunk} r={0.02} />
      ))}
      <LollyTree p={[-0.78, 0, -0.1]} s={0.9} />
      {(
        [
          [0.72, 0.42, PALETTE.purple],
          [0.85, 0.18, SCENE.flower],
          [0.6, 0.62, PALETTE.yellow],
        ] as [number, number, string][]
      ).map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position-y={0.1} castShadow>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshPhysicalMaterial color={c} {...PLASTIC} />
          </mesh>
          <mesh position-y={0.04}>
            <cylinderGeometry args={[0.02, 0.02, 0.1, 6]} />
            <meshPhysicalMaterial color={SCENE.leaf} {...PLASTIC} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** ④ 公交站：站牌 + 橙色小面包车（Car Kit 未下载，方块拼一辆） */
function BusProps() {
  return (
    <group>
      <Pole p={[-0.62, 0, -0.05]} h={1.05} c={PALETTE.ink} r={0.04} />
      <B args={[0.44, 0.44, 0.07]} p={[-0.62, 1.02, -0.05]} c={PALETTE.blue} />
      <mesh position={[-0.62, 1.02, 0.0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.13, 20]} />
        <meshPhysicalMaterial color={SCENE.tileStation} {...PLASTIC} />
      </mesh>
      {/* 面包车：圆角车身 + 浅色窗带（比车身宽一档才看得出）+ 四轮 */}
      <group position={[0.35, 0, 0.15]} rotation-y={0.15}>
        <B args={[1.0, 0.44, 0.46]} p={[0, 0.36, 0]} c={PALETTE.orange} r={0.12} />
        <B args={[0.7, 0.18, 0.54]} p={[-0.08, 0.44, 0]} c={SCENE.windowBlue} r={0.06} />
        <B args={[0.12, 0.2, 0.4]} p={[0.52, 0.4, 0]} c={SCENE.windowBlue} r={0.03} />
        <B args={[0.34, 0.32, 0.46]} p={[0.56, 0.26, 0]} c={SCENE.busCab} r={0.1} />
        {(
          [
            [-0.32, 0.24],
            [0.38, 0.24],
            [-0.32, -0.24],
            [0.38, -0.24],
          ] as [number, number][]
        ).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.11, z]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.07, 14]} />
            <meshPhysicalMaterial color={PALETTE.ink} roughness={0.9} metalness={0} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** ⑤ 随机事件站：扭蛋机 + 礼盒 */
function EventProps() {
  return (
    <group>
      <Model path="gacha-machine.glb" position={[-0.3, 0, -0.05]} scale={1.05} rotation-y={0.2} />
      <group position={[0.4, 0, 0.25]} rotation-y={-0.3}>
        <B args={[0.42, 0.32, 0.42]} p={[0, 0.16, 0]} c={PALETTE.mint} />
        <B args={[0.48, 0.1, 0.48]} p={[0, 0.36, 0]} c={PALETTE.purple} />
        <B args={[0.09, 0.44, 0.09]} p={[0, 0.3, 0]} c={PALETTE.yellow} r={0.02} />
        <mesh position-y={0.48} castShadow>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshPhysicalMaterial color={PALETTE.yellow} {...PLASTIC} />
        </mesh>
      </group>
    </group>
  );
}

/** ⑥ AI 家长站：一部大大的手机（远方家长用手机聊天） */
function ParentProps() {
  return (
    <group rotation-x={-0.07} position-z={-0.05}>
      <B args={[0.62, 0.14, 0.5]} p={[0, 0.05, 0.02]} c={SCENE.stone} />
      <B args={[0.82, 1.5, 0.14]} p={[0, 0.85, 0]} c={PALETTE.purple} r={0.09} />
      <B args={[0.66, 1.26, 0.03]} p={[0, 0.85, 0.075]} c={SCENE.windowBlue} r={0.04} />
      {/* 屏幕上的聊天气泡（无文字） */}
      <B args={[0.34, 0.2, 0.02]} p={[-0.1, 1.12, 0.1]} c={PALETTE.orange} r={0.06} />
      <B args={[0.3, 0.18, 0.02]} p={[0.12, 0.85, 0.1]} c={PALETTE.mint} r={0.06} />
      <B args={[0.34, 0.2, 0.02]} p={[-0.1, 0.6, 0.1]} c={PALETTE.orange} r={0.06} />
      <mesh position={[0, 0.28, 0.1]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.05, 16]} />
        <meshPhysicalMaterial color={SCENE.stone} {...PLASTIC} />
      </mesh>
    </group>
  );
}

/** ⑦ 小卖部：小店面（开放柜台 + 货架 + 收银台 + 小棚） */
function StoreProps() {
  return (
    <group>
      <B args={[1.2, 0.95, 0.1]} p={[0, 0.48, -0.42]} c={SCENE.islandRim} />
      <B args={[0.1, 0.95, 0.6]} p={[-0.58, 0.48, -0.12]} c={SCENE.islandRim} />
      <B args={[0.1, 0.95, 0.6]} p={[0.58, 0.48, -0.12]} c={SCENE.islandRim} />
      <B args={[1.32, 0.08, 0.85]} p={[0, 1.0, -0.14]} c={SCENE.wood} />
      <Awning w={1.28} d={0.55} y={0.98} colors={[PALETTE.blue, SCENE.tileStation]} />
      <B args={[1.05, 0.36, 0.34]} p={[0, 0.18, 0.35]} c={SCENE.wood} />
      <Model path="shelf-boxes.glb" position={[0, 0, -0.18]} scale={0.85} />
      <Model path="cash-register-self.glb" position={[0.28, 0.36, 0.33]} scale={0.62} rotation-y={0.1} />
      <Model path="bag.glb" position={[-0.32, 0.36, 0.33]} scale={0.85} />
    </group>
  );
}

/** ⑧ 回家一起做饭：小房子（烟囱冒烟，烟圈上升变淡）+ 门口小饭桌 */
function CookProps() {
  const puffs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useAmbient(70, (t) => {
    for (let i = 0; i < 3; i++) {
      const m = puffs.current[i];
      const mat = mats.current[i];
      if (!m || !mat) continue;
      const k = ((t * 0.28 + i * 0.36) % 1 + 1) % 1; // 循环上升
      m.position.set(-0.32 + i * 0.06 + Math.sin(t * 1.1 + i) * 0.05, 1.55 + k * 0.95, -0.2);
      m.scale.setScalar(0.6 + k * 0.9);
      mat.opacity = 0.75 * (1 - k);
    }
  });
  return (
    <group>
      <group position={[-0.32, 0, -0.15]}>
        <B args={[1.15, 0.85, 0.85]} p={[0, 0.43, 0]} c={SCENE.tileStation} r={0.08} />
        <mesh position-y={1.08} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[0.92, 0.55, 4]} />
          <meshPhysicalMaterial color={PALETTE.orange} {...PLASTIC} />
        </mesh>
        <B args={[0.3, 0.48, 0.06]} p={[0.18, 0.24, 0.44]} c={PALETTE.purple} r={0.04} />
        <B args={[0.22, 0.22, 0.04]} p={[-0.28, 0.52, 0.44]} c={SCENE.windowBlue} r={0.03} />
        <B args={[0.14, 0.3, 0.14]} p={[-0.32, 1.18, -0.2]} c={SCENE.wood} r={0.02} />
        {/* 烟囱冒烟：三团烟循环上升、变大变淡（§8.6） */}
        {[0.14, 0.17, 0.2].map((r0, i) => (
          <mesh
            key={i}
            ref={(m) => {
              puffs.current[i] = m;
            }}
            position={[-0.32 + i * 0.06, 1.55, -0.2]}
          >
            <sphereGeometry args={[r0, 10, 8]} />
            <meshPhysicalMaterial
              ref={(m) => {
                if (m) mats.current[i] = m;
              }}
              color={SCENE.tileStation}
              transparent
              opacity={0.6}
            />
          </mesh>
        ))}
      </group>
      {/* 门口小饭桌 + 锅盘杯（Food Kit） */}
      <group position={[0.62, 0, 0.45]}>
        <mesh position-y={0.38} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.05, 20]} />
          <meshPhysicalMaterial color={SCENE.wood} {...PLASTIC} />
        </mesh>
        <mesh position-y={0.19}>
          <cylinderGeometry args={[0.05, 0.08, 0.38, 10]} />
          <meshPhysicalMaterial color={SCENE.trunk} {...PLASTIC} />
        </mesh>
        <Model path="pot.glb" position={[-0.1, 0.4, -0.08]} scale={0.55} />
        <Model path="plate-dinner.glb" position={[0.14, 0.4, 0.1]} scale={0.5} />
        <Model path="cup.glb" position={[0.05, 0.4, -0.16]} scale={0.9} />
      </group>
    </group>
  );
}

const PROPS: Record<string, () => JSX.Element> = {
  drawTask: DrawTaskProps,
  market: MarketProps,
  partner: PartnerProps,
  bus: BusProps,
  event: EventProps,
  parent: ParentProps,
  store: StoreProps,
  cook: CookProps,
};

const DIST: Record<string, number> = { market: 1.08 };
const BLOB: Record<string, number> = { market: 1.9 };

export function StationProps({ station, shadows }: { station: BoardStation; shadows: boolean }) {
  const Inner = PROPS[station.id];
  if (!Inner) return null;
  const a = propAnchor(station.index, DIST[station.id] ?? 0.98);
  const blobTex = blobShadowTexture();
  return (
    <group position={[a.x, 0, a.z]} rotation-y={a.yaw}>
      {/* 低档无实时阴影 → 贴片影把道具「按」在地上 */}
      {!shadows && (
        <mesh position-y={0.02} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[BLOB[station.id] ?? 1.3, (BLOB[station.id] ?? 1.3) * 0.8]} />
          <meshBasicMaterial map={blobTex} transparent depthWrite={false} />
        </mesh>
      )}
      <Inner />
    </group>
  );
}
