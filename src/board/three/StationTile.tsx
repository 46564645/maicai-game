/**
 * StationTile.tsx —— 站点地砖：圆角厚积木块 + 站点识别色点 +
 * 当前站微抬 + 底部发光圈。菜市场地块放大（1.5–2×，全场最显眼）。
 */
import { RoundedBox } from '@react-three/drei';
import type { BoardStation } from '../BoardView';
import { stationAnchor } from './positions';
import { PALETTE, SCENE, STATION_COLORS, TOY_MAT } from './materials';

const TILE_Y = 0.16; // 地砖顶面高度
const LIFT = 0.12; // 当前站抬起量

export function StationTile({
  station,
  shadows,
}: {
  station: BoardStation;
  shadows: boolean;
}) {
  const { x, z, yaw } = stationAnchor(station.index);
  const isMarket = station.id === 'market';
  const w = isMarket ? 2.15 : 1.32;
  const d = isMarket ? 1.7 : 1.18;
  const y = TILE_Y + (station.isCurrent ? LIFT : 0);
  const accent = STATION_COLORS[station.index % STATION_COLORS.length];

  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      {/* 当前站发光圈（地砖底下透出的一圈光；要高于路面底带 0.09） */}
      {station.isCurrent && (
        <mesh position-y={0.115} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[Math.max(w, d) * 0.68, Math.max(w, d) * 0.86, 40]} />
          <meshBasicMaterial color={PALETTE.yellow} transparent opacity={0.85} />
        </mesh>
      )}

      {/* 圆角厚地砖（积木感） */}
      <RoundedBox
        args={[w, 0.24, d]}
        radius={0.09}
        smoothness={3}
        position-y={y}
        castShadow={shadows}
        receiveShadow={shadows}
      >
        <meshStandardMaterial
          color={SCENE.tileStation}
          emissive={station.isCurrent ? accent : '#000000'}
          emissiveIntensity={station.isCurrent ? 0.12 : 0}
          {...TOY_MAT}
        />
      </RoundedBox>

      {/* 站点识别色点（不放文字：一块斜放的小圆片） */}
      <mesh position-y={y + 0.125} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[isMarket ? 0.3 : 0.2, 24]} />
        <meshStandardMaterial color={accent} {...TOY_MAT} />
      </mesh>
    </group>
  );
}
