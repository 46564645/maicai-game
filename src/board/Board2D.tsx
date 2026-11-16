/**
 * Board2D.tsx —— DOM 小镇街道环路棋盘（2D 实现，同时是 3D 的永久兜底）。
 * 8 站顺时针环排：上 ①②、右 ③④、下 ⑥⑤、左 ⑧⑦；菜市场②地块最大最显眼；
 * 当前站加粗描边；4 枚棋子同站显示（玩家色）。中央格子放站点状态内容。
 */
import type { ReactNode } from 'react';
import type { BoardViewProps } from './BoardView';

/* 站点 index → 棋盘格区域（grid-area 名） */
const GRID_AREAS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'] as const;

export function Board2D(props: BoardViewProps & { children?: ReactNode }) {
  return (
    <section className="board" aria-label="Shopping board">
      {props.stations.map((st) => {
        const cls = [
          'board-station',
          st.isCurrent ? 'board-station--current' : '',
          st.id === 'market' ? 'board-station--featured' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={st.id}
            className={cls}
            style={{ gridArea: GRID_AREAS[st.index] }}
            data-testid={`station-${st.index + 1}`}
          >
            <span className="board-station-num" aria-hidden="true">
              {st.index + 1}
            </span>
            <span className="board-station-name">{st.name}</span>
            {st.isCurrent && (
              <span className="board-pawns">
                {props.pawns.map((p) => (
                  <span
                    key={p.playerId}
                    className={
                      'pawn' + (p.playerId === props.activePlayerId ? ' pawn--active' : '')
                    }
                    style={{ background: p.colorVar }}
                    title={p.name}
                  >
                    {p.icon}
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
      <div className="board-center">{props.children}</div>
    </section>
  );
}
