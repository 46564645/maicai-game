/**
 * materials.ts —— 3D 场景统一调色板与材质约定。
 * 色值只认 tokens.css 里的 ww 临时色板（待确认）与由其派生的柔和色；
 * 全场景圆润低模玩具风：roughness 高、metalness 0，不刺眼。
 */
import * as THREE from 'three';

/** ww 临时色板（与 tokens.css 一致） */
export const PALETTE = {
  orange: '#FF6B2C', // 暖橙·主色（你）
  yellow: '#FFC93C', // 黄·提醒（小冲）
  blue: '#5B7CFA', // 蓝（小稳）
  mint: '#7ED9B5', // 薄荷（小跟）
  purple: '#B9A3F0', // 淡紫·AI 家长
  cream: '#FFF6EC', // 奶油底
  ink: '#1E1E2A', // 墨色
} as const;

/** 场景派生色（M4.5.7 织梦岛风：饱和亮绿 + 暖沙路 + 透亮水；只改 3D，2D 色板不动） */
export const SCENE = {
  islandTop: '#63C74D', // 岛面草地（亮绿，ART §9.4 区间 #5CC94A–#7ED957）
  islandSide: '#E5C693', // 岛侧面（暖土色，ART §9.8）
  islandRim: '#F7E8D0', // 岛沿一圈浅滩
  water: '#6ECBE8', // 水面中间调（渐变 canvas 的备用纯色）
  waterShallow: '#7FD8F0', // 近岸浅水（ART §9.9）
  waterDeep: '#3BA7D9', // 远处深水（ART §9.9）
  foam: '#FFFFFF', // 岸白沫线（ART §9.9）
  roadBed: '#E0B36B', // 路面底带（暖沙黄，环路一眼可读）
  tilePath: '#FFF1D6', // 过渡地砖（亮奶油，在深色路带上跳得出）
  tilePathAlt: '#EFD096', // 过渡地砖交替色（opt/visual V2：#F4DCAC 再深一档，交替节奏在取景距离可读）
  tileStation: '#FFFDF6', // 站点地砖（更亮一档，像积木）
  glow: PALETTE.orange, // 当前站发光圈
  wood: '#D9A066', // 木质道具点缀（暖橙淡调）
  leaf: '#4FBF58', // 树冠（比草深一档半，织梦岛树是深绿球，ART §9.4）
  bush: '#3E9E4A', // 灌木（比草深两档）
  bushDark: '#357F3C', // 灌木深色
  trunk: '#C78D5A', // 树干
  stone: '#D8D2C8', // 石头
  flower: '#FFB3C7', // 花（旧点缀沿用）
  skyTop: '#BFE3F2', // 天光渐变顶
  skyBottom: '#FFF6EC', // 天光渐变底（奶油）
  windowBlue: '#CFE8F5', // 玻璃/屏幕反光（车窗、手机屏幕）
  busCab: '#E8561B', // 公交车头（主橙深一档）
} as const;

/** 花草点缀三色组（ART §9.7：花用亮黄、粉、蓝） */
export const FLOWER_COLORS = ['#FFD93D', '#FF8FB2', '#7FB5FF'] as const;

/**
 * 塑料玩具材质（ART §9.3：有光泽、像软塑料，绝非平涂）：
 * clearcoat 清漆层 + envMapIntensity 环境反光；配 <Environment> HDRI。
 * 用于道具/建筑/树/转盘/棋子等「塑料件」。
 */
export const PLASTIC = {
  roughness: 0.4,
  metalness: 0,
  clearcoat: 0.3,
  clearcoatRoughness: 0.35,
  envMapIntensity: 0.7,
} as const;

/** 哑光面（ART §9.3：地砖、土路、草皮保持哑光 roughness 0.8） */
export const MATTE = { roughness: 0.8, metalness: 0, envMapIntensity: 0.35 } as const;

/** @deprecated M4.5.7 起哑光面用 MATTE、塑料件用 PLASTIC；保留别名兼容旧用法 */
export const TOY_MAT = MATTE;

/** pawn.colorVar（CSS 变量名）→ 实色（3D 材质用不了 CSS 变量） */
const COLOR_VARS: Record<string, string> = {
  'var(--player-you)': PALETTE.orange,
  'var(--player-steady)': PALETTE.blue,
  'var(--player-impulsive)': PALETTE.yellow,
  'var(--player-follower)': PALETTE.mint,
};

export function pawnColor(colorVar: string): string {
  return COLOR_VARS[colorVar] ?? PALETTE.orange;
}

/** 贴片影（低档画质无实时阴影时用）：径向渐隐圆形，垫在棋子/道具底下 */
let blob: THREE.CanvasTexture | null = null;
export function blobShadowTexture(): THREE.CanvasTexture {
  if (blob) return blob;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(30,30,42,0.42)');
  grad.addColorStop(0.65, 'rgba(30,30,42,0.18)');
  grad.addColorStop(1, 'rgba(30,30,42,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  blob = new THREE.CanvasTexture(c);
  return blob;
}

/** 站点 index → 主题色（站点地砖上的识别色点；不依赖文字） */
export const STATION_COLORS = [
  PALETTE.purple, // ① 抽任务卡
  PALETTE.orange, // ② 菜市场（主色，最大）
  PALETTE.mint, // ③ 伙伴站
  PALETTE.blue, // ④ 公交站
  PALETTE.yellow, // ⑤ 随机事件
  PALETTE.purple, // ⑥ AI 家长
  PALETTE.blue, // ⑦ 小卖部
  PALETTE.orange, // ⑧ 回家做饭
] as const;
