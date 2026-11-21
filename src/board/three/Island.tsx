/**
 * Island.tsx —— 圆角有厚度的小岛基座 + 一圈浅水。
 * 岛体：圆角矩形挤出（顶面草地色、侧面奶油色，挤出的 bevel 给出圆润倒角），
 * 底部垫一圈更宽的浅滩沿 + 一片大水面。程序化几何，玩具积木感。
 * M4.5.7（ART_3D §9.9）：水面径向渐变（近岸浅蓝透亮→外缘深一档）+
 * 岸白沫线（贴岛沿的白色泡沫双环，呼吸微动）。
 * R5：海铺满全屏 —— 渐变圆盘只保留近岸浅水环，底下垫一块超大深水
 * 平面延到雾程外（径向渐变外缘色 = 深水色，接缝不可见）；水面有
 * 细噪声凹凸；外海点缀玩具小船/浮标，不遮岛。
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { PALETTE, PLASTIC, SCENE, TOY_MAT } from './materials';
import { foamNoiseTexture, grassMaps, waterNoiseTexture } from './textures';
import { useAmbient } from './ambient';

const ISLAND_W = 15.2; // 岛宽（x）
const ISLAND_D = 11.4; // 岛深（z）
const ISLAND_R = 2.6; // 圆角半径
const THICK = 0.85; // 厚度
// 挤出的上表面盖在 bevel 顶（+0.28），整体下沉让草皮顶面落在 y=0，
// 路带/地砖/道具/棋子都按 y=0 地面摆放
const TOP_Y = -0.28;

/** 圆角矩形 Shape（在 xy 平面，之后旋转躺到 xz）；StreetLoop 的路带也用它 */
export function roundedRectShape(w: number, d: number, r: number): THREE.Shape {
  const x = -w / 2;
  const y = -d / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** 水面波光：岛沿几圈扩散又淡出的涟漪环（ART_3D §8.6 水要有波光） */
function Ripples() {
  const RIPPLES = useMemo(
    () =>
      [
        { x: -8.4, z: -5.2, phase: 0 },
        { x: 8.6, z: 4.4, phase: 0.37 },
        { x: 0.6, z: 7.2, phase: 0.7 },
      ].map((r) => ({
        ...r,
        mat: new THREE.MeshBasicMaterial({
          color: '#FFFFFF',
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      })),
    [],
  );
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  useAmbient(90, (t) => {
    RIPPLES.forEach((r, i) => {
      const k = ((t * 0.32 + r.phase) % 1 + 1) % 1; // 3s 一轮
      const m = rings.current[i];
      if (!m) return;
      r.mat.opacity = (1 - k) * 0.4;
      m.scale.setScalar(0.55 + k * 1.6);
      m.visible = r.mat.opacity > 0.02;
    });
  });
  return (
    <group>
      {RIPPLES.map((r, i) => (
        <mesh
          key={i}
          ref={(m) => {
            rings.current[i] = m;
          }}
          position={[r.x, -0.69, r.z]}
          rotation-x={-Math.PI / 2}
          material={r.mat}
          visible={false}
        >
          <ringGeometry args={[0.5, 0.62, 36]} />
        </mesh>
      ))}
    </group>
  );
}

/** 水面径向渐变贴图：中心浅（被岛遮住）→ 近岸浅水色 → 外缘深水色（ART §9.9） */
function waterGradientTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, SCENE.waterShallow);
  grad.addColorStop(0.45, SCENE.waterShallow);
  grad.addColorStop(0.95, SCENE.waterDeep);
  grad.addColorStop(1, SCENE.waterDeep);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 岸白沫线：贴岛沿的白色泡沫环（扁平环 ×2，透明度/缩放呼吸微动，ART §9.9）。
 *  R5：alphaMap 泡沫噪声 —— 泡沫断成一串泡泡团，不再是完美几何环。 */
function FoamRing() {
  // 泡沫环 = 圆角矩形外轮廓 − 略小于浅滩沿的内孔（内缘藏进滩沿下）
  const geoNear = useMemo(() => {
    const s = roundedRectShape(17.4, 13.6, 3.0);
    s.holes.push(
      new THREE.Path(roundedRectShape(16.55, 12.75, 3.1).getPoints(64).reverse()),
    );
    return new THREE.ShapeGeometry(s, 10);
  }, []);
  const geoFar = useMemo(() => {
    const s = roundedRectShape(18.5, 14.7, 3.2);
    s.holes.push(
      new THREE.Path(roundedRectShape(16.45, 12.65, 3.05).getPoints(64).reverse()),
    );
    return new THREE.ShapeGeometry(s, 10);
  }, []);
  const foamAlpha = useMemo(() => {
    const t = foamNoiseTexture();
    // ShapeGeometry 的 UV = 形状坐标（约 ±9），repeat 让噪声团大小适中
    t.repeat.set(0.22, 0.22);
    return t;
  }, []);
  const nearMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SCENE.foam,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        alphaMap: foamAlpha,
      }),
    [foamAlpha],
  );
  const farMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SCENE.foam,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        alphaMap: foamAlpha,
      }),
    [foamAlpha],
  );
  const near = useRef<THREE.Mesh>(null);
  const far = useRef<THREE.Mesh>(null);
  useAmbient(90, (t) => {
    const k = Math.sin(t * 2.1); // ~3s 一轮呼吸
    // opt/visual V4：泡沫基线抬高（近环 0.45→0.58、远环 0.26→0.34），
    // 岸线在取景距离不再只是一道淡晕
    nearMat.opacity = 0.58 + k * 0.12;
    farMat.opacity = 0.34 + Math.sin(t * 2.1 + 1.3) * 0.08;
    near.current?.scale.setScalar(1 + k * 0.012);
    far.current?.scale.setScalar(1 + Math.sin(t * 2.1 + 1.3) * 0.018);
  });
  return (
    <group rotation-x={-Math.PI / 2} position-y={-0.68}>
      <mesh ref={near} geometry={geoNear} material={nearMat} renderOrder={1} />
      <mesh ref={far} geometry={geoFar} material={farMat} renderOrder={1} />
    </group>
  );
}

/** 玩具小帆船：胡桃壳船体 + 三角帆 + 小旗，轻轻起伏（外海点缀，R5） */
function ToyBoat({
  x,
  z,
  ry,
  hull,
  sail,
  flag,
}: {
  x: number;
  z: number;
  ry: number;
  hull: string;
  sail: string;
  flag: string;
}) {
  const g = useRef<THREE.Group>(null);
  const phase = x * 0.9 + z * 1.4;
  useAmbient(110, (t) => {
    if (!g.current) return;
    g.current.position.y = -0.66 + Math.sin(t * 1.05 + phase) * 0.045;
    g.current.rotation.z = Math.sin(t * 0.8 + phase * 1.3) * 0.05;
    g.current.rotation.x = Math.sin(t * 0.62 + phase) * 0.03;
  });
  return (
    <group ref={g} position={[x, -0.66, z]} rotation-y={ry}>
      {/* 胡桃壳船体：压扁的圆球，上半露出水面 */}
      <mesh scale={[1.35, 0.5, 0.62]} castShadow={false}>
        <sphereGeometry args={[0.62, 16, 12]} />
        <meshPhysicalMaterial color={hull} {...PLASTIC} />
      </mesh>
      {/* 船舷上沿一圈浅色 */}
      <RoundedBox
        args={[1.5, 0.1, 0.7]}
        radius={0.05}
        smoothness={3}
        position-y={0.16}
        castShadow={false}
      >
        <meshPhysicalMaterial color={PALETTE.cream} {...PLASTIC} />
      </RoundedBox>
      {/* 桅杆 + 三角帆 + 小旗 */}
      <mesh position-y={0.62} castShadow={false}>
        <cylinderGeometry args={[0.035, 0.045, 0.95, 8]} />
        <meshPhysicalMaterial color={PALETTE.cream} {...PLASTIC} />
      </mesh>
      <mesh position={[0.02, 0.62, 0.03]} rotation-y={Math.PI / 2} castShadow={false}>
        <circleGeometry args={[0.42, 3]} />
        <meshPhysicalMaterial color={sail} {...PLASTIC} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.34, 0.42, 0.03]} rotation-y={Math.PI / 2} rotation-z={Math.PI}>
        <circleGeometry args={[0.34, 3]} />
        <meshPhysicalMaterial color={sail} {...PLASTIC} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.1, 1.08, 0.03]} rotation-y={Math.PI / 2}>
        <circleGeometry args={[0.09, 3]} />
        <meshBasicMaterial color={flag} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** 小浮标：圆球 + 白条 + 小尖顶，轻轻漂 */
function Buoy({ x, z, c }: { x: number; z: number; c: string }) {
  const g = useRef<THREE.Group>(null);
  const phase = x * 1.1 + z * 0.7;
  useAmbient(130, (t) => {
    if (!g.current) return;
    g.current.position.y = -0.68 + Math.sin(t * 1.2 + phase) * 0.04;
    g.current.rotation.z = Math.sin(t * 0.95 + phase) * 0.07;
  });
  return (
    <group ref={g} position={[x, -0.68, z]}>
      <mesh scale={[1, 0.82, 1]} castShadow={false}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshPhysicalMaterial color={c} {...PLASTIC} />
      </mesh>
      <mesh position-y={0.02} castShadow={false}>
        <cylinderGeometry args={[0.225, 0.225, 0.07, 12]} />
        <meshPhysicalMaterial color="#FFF6EC" {...PLASTIC} />
      </mesh>
      <mesh position-y={0.24} castShadow={false}>
        <coneGeometry args={[0.08, 0.2, 10]} />
        <meshPhysicalMaterial color={c} {...PLASTIC} />
      </mesh>
    </group>
  );
}

export function Island({ shadows }: { shadows: boolean }) {
  // 岛体：挤出的圆角矩形（材质 0=上下盖、1=侧壁）
  const islandGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(roundedRectShape(ISLAND_W, ISLAND_D, ISLAND_R), {
      depth: THICK,
      bevelEnabled: true,
      bevelThickness: 0.28,
      bevelSize: 0.28,
      bevelSegments: 3,
      curveSegments: 10,
    });
    g.computeVertexNormals();
    return g;
  }, []);

  // 浅滩沿：同样圆角矩形放大一点，薄
  const rimGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(
      roundedRectShape(ISLAND_W + 1.6, ISLAND_D + 1.6, ISLAND_R + 0.8),
      { depth: 0.3, bevelEnabled: false, curveSegments: 10 },
    );
    g.computeVertexNormals();
    return g;
  }, []);

  // 草皮手绘斑驳（R5）：贴图单幅覆盖整座岛顶（挤出 UV = 形状坐标 ±8；
  // offset 0.5 把接缝移出岛面），map 给斑驳色、bump 给细微起伏；map 自带基色 → 材质白底
  const grass = useMemo(() => {
    const m = grassMaps();
    m.map.repeat.set(1 / 15.6, 1 / 15.6);
    m.map.offset.set(0.5, 0.5);
    m.bump.repeat.set(1 / 15.6, 1 / 15.6);
    m.bump.offset.set(0.5, 0.5);
    return m;
  }, []);

  // 深水噪声凹凸（R5）：大平面重复平铺，微幅波光
  const waterBump = useMemo(() => {
    const t = waterNoiseTexture();
    t.repeat.set(14, 14);
    return t;
  }, []);

  // opt/visual V4：水面缓漂——噪声贴图极慢偏移（整周期 ~2 分钟），
  // 近岸与外海的 bump 一起动，水面不再是一张静止的平色
  useAmbient(140, (t) => {
    waterBump.offset.set((t * 0.008) % 1, (t * 0.005) % 1);
  });

  return (
    <group>
      {/* 岛体（盖=草地色顶面，壁=奶油侧面）；旋转后厚度向下，顶面在 TOP_Y */}
      <mesh
        geometry={islandGeo}
        rotation-x={Math.PI / 2}
        position-y={TOP_Y}
        receiveShadow={shadows}
        castShadow={false}
      >
        <meshStandardMaterial
          attach="material-0"
          color="#FFFFFF"
          map={grass.map}
          bumpMap={grass.bump}
          bumpScale={0.06}
          {...TOY_MAT}
        />
        <meshStandardMaterial attach="material-1" color={SCENE.islandSide} {...TOY_MAT} />
      </mesh>

      {/* opt/visual V1：转盘广场出入口——南北各一条沙土小径从环路
          内缘通到广场边，广场不再是空草坪正中一座孤岛 */}
      {[2.47, -2.47].map((z) => (
        <mesh key={z} position={[0, 0.006, z]} rotation-x={-Math.PI / 2} receiveShadow={shadows}>
          <planeGeometry args={[1.05, 1.1]} />
          <meshStandardMaterial color={SCENE.roadBed} {...TOY_MAT} />
        </mesh>
      ))}

      {/* 浅滩沿（岛外一圈浅色，像被水泡软的沙滩） */}
      <mesh geometry={rimGeo} rotation-x={Math.PI / 2} position-y={-0.62}>
        <meshStandardMaterial attach="material-0" color={SCENE.islandRim} {...TOY_MAT} />
        <meshStandardMaterial attach="material-1" color={SCENE.islandRim} {...TOY_MAT} />
      </mesh>

      {/* 深水底面：超大平面延到雾程外，海水铺满全屏（R5 A1）。
          比渐变盘低 0.02 防 z-fight；与渐变外缘同深 → 无缝 */}
      <mesh position-y={-0.74} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[420, 420, 1, 1]} />
        <meshStandardMaterial
          color={SCENE.waterDeep}
          roughness={0.62}
          metalness={0}
          envMapIntensity={0.3}
          bumpMap={waterBump}
          bumpScale={0.1}
        />
      </mesh>

      {/* 近岸浅水：渐变圆盘（近岸浅→外缘深），外缘与深水同色 → 无缝过渡。
          opt/visual V4：与深水共用同一张噪声 bump（repeat 14 在圆盘
          UV 上 ≈2.3 世界单位/特征），近岸也有缓漂的波光 */}
      <mesh position-y={-0.72} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial
          map={waterGradientTexture()}
          roughness={0.62}
          metalness={0}
          envMapIntensity={0.3}
          bumpMap={waterBump}
          bumpScale={0.08}
        />
      </mesh>

      {/* 岸白沫线 + 涟漪环（水面波光） */}
      <FoamRing />
      <Ripples />

      {/* 外海玩具点缀：船与浮标都在浅滩沿之外的水面上，不遮岛与站点。
          配色只用蓝/紫/奶油白——避免绿/暖色被岛屿像素分割误算进岛体
          （测量口径 green/tan），白壳船在蓝海上反而更跳。
          R2-E8 硬指标（海/岛/船三项一起判）：桌面与手机横屏各至少
          一艘船完整可见、不被任何面板挡。旧锚点在 R2 取景下三艘都
          滑出画面/栏后；按 solveFit 相机模型投影船体点云选点（脚本
          shots/boat-proj-check.ts）：白船移岛左上外海——桌面投影
          包围盒 212..290×75..138 ⊆ 自由矩形；蓝船移岛右上外海——
          手机投影包围盒 566..601×89..122 ⊆ 自由矩形（右栏左侧）。
          两锚点到浅滩轮廓的带符号距离 ≈1.5 ≥ 船体包围圆 1.35，
          全船在水里、不压浅滩。 */}
      <ToyBoat x={-8.25} z={-7.38} ry={0.7} hull={PALETTE.cream} sail={PALETTE.cream} flag={PALETTE.blue} />
      <ToyBoat x={10} z={-5.25} ry={-1.1} hull={PALETTE.blue} sail={PALETTE.cream} flag={PALETTE.purple} />
      <ToyBoat x={-15} z={3.5} ry={1.35} hull={PALETTE.purple} sail={PALETTE.cream} flag={PALETTE.blue} />
      <Buoy x={13.5} z={-9.5} c={PALETTE.blue} />
      <Buoy x={-12.5} z={9.5} c={PALETTE.purple} />
    </group>
  );
}
