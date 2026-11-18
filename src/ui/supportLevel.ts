/**
 * supportLevel.ts —— R10 Slice D（education #5）：脚手架随圈数退场。
 * 纯函数，只读 state.lap，不碰引擎/配置：
 *   第 1 圈 = 全扶持（现状：完整说明句 + bot 心里话全量）
 *   第 2 圈 = 半扶持（站点说明收成「图标+短句」；bot 气泡只留「先等等」）
 *   第 3 圈 = 撤扶持（市场/小卖部无说明句；反思提示换前瞻句
 *             ——只限菜谱已买齐的孩子，见 Reflection.tsx）
 */
export type SupportLevel = 1 | 2 | 3;

export function supportLevel(lap: number): SupportLevel {
  if (lap <= 1) return 1;
  if (lap === 2) return 2;
  return 3;
}

/** 站点面板顶上的「怎么玩」说明句：full=完整句 / compact=图标+短句 / none=撤掉 */
export type PanelHint = 'full' | 'compact' | 'none';

export function panelHintFor(lap: number): PanelHint {
  const lv = supportLevel(lap);
  return lv === 1 ? 'full' : lv === 2 ? 'compact' : 'none';
}

/** bot 心里话气泡：第 2 圈起只剩「先等等」那一条还冒（其它短理由撤） */
export function botBubbleAllowed(lap: number, isHoldLine: boolean): boolean {
  return supportLevel(lap) === 1 || isHoldLine;
}
