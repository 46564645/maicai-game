/**
 * gltf.ts —— GLB 加载 / 克隆 / 换色工具（DEVELOPMENT §9.1、§9.3）。
 * - useGLTF 缓存原始 scene；每个用处用 SkeletonUtils.clone 克隆（蒙皮与普通网格通用）。
 * - Kenney 全包共用一张 colormap：对网格做「乘算换色」会把肤色也染掉，
 *   所以棋子做法是给身体 mesh 换成玩家色的纯色材质（像穿着玩家色外套），
 *   头/脸保留原贴图，既统一又一眼认出「这是谁」。
 * - M4.5.7 织梦岛风：加载时统一把 MeshStandardMaterial 升级成带清漆层的
 *   MeshPhysicalMaterial（ART §9.3 塑料玩具光泽、ART §10「加载模型时统一替换」），
 *   colormap 贴图与颜色原样保留；userData.plastic 标记保证幂等（克隆共享材质不串染）。
 */
import { useMemo } from 'react';
import { createElement } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { PLASTIC } from './materials';

/**
 * 把场景里所有 MeshStandardMaterial 换成 MeshPhysicalMaterial（塑料光泽）。
 * 只转 useGLTF 缓存的源场景一次：克隆共享材质，userData.plastic 幂等标记。
 */
export function upgradeToPlastic(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((src, i) => {
      const s = src as THREE.MeshStandardMaterial | undefined;
      if (!s || !(s as THREE.Material).isMaterial) return;
      if (s.userData?.plastic) return; // 幂等：已转过
      if ((s as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        s.userData.plastic = true;
        return;
      }
      if (!s.isMeshStandardMaterial) return; // 非 PBR 材质（basic 等）不动
      const p = new THREE.MeshPhysicalMaterial({
        color: s.color.clone(),
        map: s.map ?? null,
        roughness: Math.min(s.roughness, 0.45),
        metalness: Math.min(s.metalness, 0.1),
        clearcoat: PLASTIC.clearcoat,
        clearcoatRoughness: PLASTIC.clearcoatRoughness,
        envMapIntensity: PLASTIC.envMapIntensity,
        transparent: s.transparent,
        opacity: s.opacity,
        side: s.side,
        vertexColors: s.vertexColors,
      });
      p.name = s.name;
      p.userData.plastic = true;
      mats[i] = p;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
  });
}

/** 加载并克隆一份可独立摆放的场景（克隆结果按 path+scene 记忆；源场景塑料化一次） */
export function useClonedScene(path: string): THREE.Group {
  const { scene } = useGLTF(`./models/${path}`);
  return useMemo(() => {
    upgradeToPlastic(scene);
    return SkeletonUtils.clone(scene) as THREE.Group;
  }, [scene]);
}

/** 递归设置投影/接收阴影 */
export function setShadows(root: THREE.Object3D, cast: boolean, receive = false): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = cast;
      m.receiveShadow = receive;
    }
  });
}

/**
 * 把指定名字的 mesh 换成玩家色的纯色塑料材质（光泽玩具感）。
 * 用于棋子「身体」染色；未命中的 mesh（如 head-mesh 的脸）保持原样。
 * 每个克隆新建材质，不共享、不串染。
 */
export function tintMeshes(
  root: THREE.Object3D,
  hex: string,
  meshNames: readonly string[],
): void {
  const color = new THREE.Color(hex);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !meshNames.includes(m.name)) return;
    const p = new THREE.MeshPhysicalMaterial({
      color,
      roughness: PLASTIC.roughness,
      metalness: 0,
      clearcoat: PLASTIC.clearcoat,
      clearcoatRoughness: PLASTIC.clearcoatRoughness,
      envMapIntensity: PLASTIC.envMapIntensity,
    });
    p.userData.plastic = true;
    m.material = p;
  });
}

/** 静态道具组件：克隆 + 阴影；属性直接透传给 primitive（.ts 文件用 createElement） */
export function Model({
  path,
  shadows = true,
  ...props
}: {
  path: string;
  shadows?: boolean;
} & Record<string, unknown>) {
  const obj = useClonedScene(path);
  useMemo(() => setShadows(obj, shadows, true), [obj, shadows]);
  return createElement('primitive', { object: obj, ...props });
}
