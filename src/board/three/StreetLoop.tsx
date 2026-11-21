/**
 * StreetLoop.tsx —— 小镇街道环路：8 块站点地砖 + 站间 2–3 块过渡圆角地砖，
 * 全部沿圆角矩形路径（positions.ts）摆放，像一串奶油色积木。
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import type { BoardStation } from '../BoardView';
import { LOOP, loopPoint, transitionTs } from './positions';
import { roundedRectShape } from './Island';
import { SCENE, TOY_MAT } from './materials';
import { roadMaps } from './textures';
import { StationTile } from './StationTile';

/** 路面底带：沿环路的一条暖沙色环带（外圆角矩形 − 内圆角矩形），
 *  地砖垫在它上面，让「街道」一眼可读；
 *  R5：手绘砂砾贴图单幅覆盖（挤出 UV=形状坐标 ±7），不再是平涂 */
function StreetBed() {
  const geo = useMemo(() => {
    const outer = roundedRectShape(
      2 * (LOOP.hx + 0.95),
      2 * (LOOP.hz + 0.95),
      LOOP.r + 0.95,
    );
    // 洞必须反向绕序，否则 earcut 三角化失败、整条路带不渲染
    const holePts = roundedRectShape(
      2 * (LOOP.hx - 0.95),
      2 * (LOOP.hz - 0.95),
      Math.max(0.3, LOOP.r - 0.95),
    )
      .getPoints(48)
      .reverse();
    outer.holes.push(new THREE.Path(holePts));
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: 0.1,
      bevelEnabled: false,
      curveSegments: 10,
    });
    g.computeVertexNormals();
    return g;
  }, []);
  const road = useMemo(() => {
    const m = roadMaps();
    m.map.repeat.set(1 / 14, 1 / 14);
    m.map.offset.set(0.5, 0.5);
    return m;
  }, []);
  return (
    <mesh geometry={geo} rotation-x={Math.PI / 2} position-y={0.1} receiveShadow>
      <meshStandardMaterial attach="material-0" color="#FFFFFF" map={road.map} {...TOY_MAT} />
      <meshStandardMaterial attach="material-1" color={SCENE.roadBed} {...TOY_MAT} />
    </mesh>
  );
}

/** 过渡地砖（比站砖小一号，颜色交替）。
 *  opt/visual V2：每块砖顶嵌一枚沙色小箭头（>> 形），交替色再加深
 *  一档——不识字的孩子也能顺着箭头看出队伍往哪边走、砖与砖的节奏。
 *  箭头朝向不用砖的 yaw 直接套：loopPoint 的 yaw 只保证砖的长轴
 *  沿路（对称盒子无所谓正反），数值微分出的真实行进切向才是准的
 *  （实测竖边上 yaw 与行进方向恰好相反，横边相同）。 */
function PathTile({ t, alt, shadows }: { t: number; alt: boolean; shadows: boolean }) {
  const { x, z, yaw } = loopPoint(t);
  const ahead = loopPoint(t + 0.004);
  const phi = Math.atan2(-(ahead.z - z), ahead.x - x); // 局部 +X 对齐行进切向
  return (
    <group position={[x, 0, z]}>
      <RoundedBox
        args={[1.15, 0.22, 0.95]}
        radius={0.08}
        smoothness={3}
        position-y={0.12}
        rotation-y={yaw}
        castShadow={shadows}
        receiveShadow={shadows}
      >
        <meshStandardMaterial color={alt ? SCENE.tilePathAlt : SCENE.tilePath} {...TOY_MAT} />
      </RoundedBox>
      {/* 箭头两臂：0.30 长薄片，绕 Y ±0.63 在 +X 侧合成尖角 */}
      <group rotation-y={phi}>
        {[0.63, -0.63].map((ry, i) => (
          <mesh
            key={i}
            position={[-0.01, 0.238, i === 0 ? 0.08 : -0.08]}
            rotation-y={ry}
          >
            <boxGeometry args={[0.3, 0.014, 0.055]} />
            <meshStandardMaterial color={SCENE.roadBed} {...TOY_MAT} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function StreetLoop({
  stations,
  shadows,
}: {
  stations: BoardStation[];
  shadows: boolean;
}) {
  return (
    <group>
      <StreetBed />
      {stations.map((_, i) =>
        transitionTs(i).map((t, k) => (
          <PathTile key={`t${i}-${k}`} t={t} alt={(i + k) % 2 === 0} shadows={shadows} />
        )),
      )}
      {stations.map((s) => (
        <StationTile key={s.id} station={s} shadows={shadows} />
      ))}
    </group>
  );
}
