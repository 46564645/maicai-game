/**
 * BusPanel.tsx —— 04 公交站：车票卡 + 投币 / 记待付夹。
 * 文案强调「车费一开始就说过啦，不是惩罚」（REQUIREMENTS §5.04）。
 */
import { gameConfig } from '../config/gameConfig';
import { coinWord, strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';

export function BusPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const me = state.players.find((p) => p.isHuman)!;
  const fee = gameConfig.busFeeByLap[state.lap - 1] ?? 0;
  const canPay = me.coins >= fee;
  const label =
    fee <= 0
      ? strings.actions.busFreeDone
      : canPay
        ? fmt(strings.actions.payBus, { n: fee })
        : strings.actions.busDebt;

  return (
    <div className="panel-body">
      <div className="bus-ticket">
        <span className="bus-ticket-icon" aria-hidden="true">
          🚌
        </span>
        <span className="bus-ticket-name">
          {strings.panel.busTicket} · {fee} {coinWord(fee)}
        </span>
        <span className="bus-ticket-note">{strings.bus.announced}</span>
      </div>
      {me.busDebt > 0 && (
        <p className="panel-text">{fmt(strings.game.debtLeft, { n: me.busDebt })}</p>
      )}
      <Button
        variant="primary"
        keyHint="1"
        data-testid="action-primary"
        data-primary="true"
        data-key={1}
        speakText={label}
        onClick={() => send({ type: 'PAY_BUS' })}
      >
        {label}
      </Button>
    </div>
  );
}
