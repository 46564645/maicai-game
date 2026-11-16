/**
 * AutoPanel.tsx —— 兜底面板：把 selectors.availableCommands 逐条渲染成按钮。
 * 任何 pendingDecision 都立即可玩；正式面板（MarketPanel 等）逐站替换它。
 * 第 1 条命令渲染为主按钮（data-primary + action-primary），其余编号 2..n。
 */
import { availableCommands } from '../game/selectors';
import { describeCommand } from '../ui/describeCommand';
import type { Command, EngineResult, GameState } from '../game/types';
import { Button } from './Button';

export function AutoPanel({
  state,
  send,
}: {
  state: GameState;
  send: (cmd: Command) => EngineResult | unknown;
}) {
  const cmds = availableCommands(state);
  if (cmds.length === 0) return null;
  return (
    <div className="auto-panel">
      {cmds.map((c, i) => {
        const primary = i === 0;
        return (
          <Button
            key={i}
            variant={primary ? 'primary' : 'secondary'}
            keyHint={String(i + 1)}
            data-testid={primary ? 'action-primary' : `action-${i + 1}`}
            data-primary={primary ? 'true' : undefined}
            data-key={i + 1}
            onClick={() => send(c)}
          >
            {describeCommand(state, c)}
          </Button>
        );
      })}
    </div>
  );
}
