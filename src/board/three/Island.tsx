/**
 * Island.tsx —— 圆角有厚度的小岛基座 + 一圈浅水。
 * 岛体：圆角矩形挤出（顶面草地色、侧面奶油色，挤出的 bevel 给出圆润倒角），
 * 底部垫一圈更宽的浅滩沿 + 一片大水面。程序化几何，玩具积木感。
 * M4.5.7（ART_3D §9.9）：水面径向渐变（近岸浅蓝透亮→外缘深一档）+
 * 岸白沫线（贴岛沿的白色泡沫双环，呼吸微动）。
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SCENE, TOY_MAT } from './materials';
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

/** 岸白沫线：贴岛沿的白色泡沫环（扁平环 ×2，透明度/缩放呼吸微动，ART §9.9） */
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
  const nearMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SCENE.foam,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );
  const farMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: SCENE.foam,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    [],
  );
  const near = useRef<THREE.Mesh>(null);
  const far = useRef<THREE.Mesh>(null);
  useAmbient(90, (t) => {
    const k = Math.sin(t * 2.1); // ~3s 一轮呼吸
    nearMat.opacity = 0.45 + k * 0.12;
    farMat.opacity = 0.26 + Math.sin(t * 2.1 + 1.3) * 0.08;
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
        <meshStandardMaterial attach="material-0" color={SCENE.islandTop} {...TOY_MAT} />
        <meshStandardMaterial attach="material-1" color={SCENE.islandSide} {...TOY_MAT} />
      </mesh>

      {/* 浅滩沿（岛外一圈浅色，像被水泡软的沙滩） */}
      <mesh geometry={rimGeo} rotation-x={Math.PI / 2} position-y={-0.62}>
        <meshStandardMaterial attach="material-0" color={SCENE.islandRim} {...TOY_MAT} />
        <meshStandardMaterial attach="material-1" color={SCENE.islandRim} {...TOY_MAT} />
      </mesh>

      {/* 大水面：一块大圆盘，托住整座岛（径向渐变：近岸浅→外缘深） */}
      <mesh position-y={-0.72} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[14.5, 48]} />
        <meshStandardMaterial
          map={waterGradientTexture()}
          roughness={0.62}
          metalness={0}
          envMapIntensity={0.3}
        />
      </mesh>

      {/* 岸白沫线 + 涟漪环（水面波光） */}
      <FoamRing />
      <Ripples />
    </group>
  );
}
