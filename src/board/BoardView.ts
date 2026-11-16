/**
 * BoardView.ts —— 棋盘视图接口（PLAN 4.1.1）。
 * 2D（Board2D，本里程碑实现，也是 3D 的永久兜底）与 M4.5 的 Board3D
 * 共用同一份 BoardViewProps；全部由 GameState 派生，引擎零改动。
 */
import type { CardId, PlayerId, StationId } from '../game/types';

export interface BoardStation {
  index: number; // 0..7（界面站点编号 = index+1）
  id: StationId;
  name: string;
  goal: string; // 「练 · …」学习目标标签
  isCurrent: boolean;
}

/** 棋子：无骰子，所有棋子同站显示 */
export interface BoardPawn {
  playerId: PlayerId;
  name: string;
  icon: string;
  colorVar: string; // CSS 变量引用，如 'var(--player-you)'
  /** M4.5.4 追加（Board2D 忽略）：菜谱进度，3D 用它检测「凑齐一道菜」撒彩纸 */
  recipe?: { done: number; total: number };
}

export interface BoardViewProps {
  stations: BoardStation[];
  pawns: BoardPawn[];
  lap: number;
  laps: number;
  stationIndex: number;
  order: PlayerId[]; // 本站行动顺序
  activePlayerId: PlayerId | null; // 当前行动者（轮到谁谁亮）
  /** M4.5 追加（Board2D 忽略，向后兼容）：天气转盘演出输入。
   *  id 由引擎先定（turn.sub.weatherId），3D 只负责演出；
   *  nonce=turn.orderIndex，区分同一玩家同站连转/同天气连出。 */
  weather?: { id: CardId | null; nonce: number };
  /** M4.5.4 追加（Board2D 忽略）：最近一次「得/失币」信号（流水 log 派生），
   *  3D 用它播硬币飞行动画；nonce=log.id，同一笔不重复触发。 */
  fx?: { nonce: number; playerId: PlayerId | null; kind: 'spend' | 'gain' };
  /** M4.5.6 追加（Board2D 忽略）：视图选项而非 state 派生——
   *  手机横屏窄画布，3D 相机更贴近当前棋子（ww：镜头对准自己的棋子）。 */
  compact?: boolean;
}
