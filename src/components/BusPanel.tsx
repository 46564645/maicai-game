/**
 * BusPanel.tsx —— 04 公交站（R10 Slice B）：车票卡一枚立在手位，
 * 两个等价上车路径——
 *   · 拖拽：按住车票拖到「上车」车门区，松手命中 → PAY_BUS；
 *   · tap-tap：点车票选中（上抬+描边）→ 点「上车」大按钮 → PAY_BUS；
 *     车票没选中也照点（与旧单按钮流程完全等价，键盘 [1]/Enter 不变）。
 * 打出时在车门区迸一次 PlaySpark。欠费 chip 与「车费一开始就说过啦」
 * 文案原样保留（REQUIREMENTS §5.04）。
 * 注（Slice B 记录）：上车只有「拖到车门」一条拖拽投放区——棋盘被弹窗
 * 遮住，「拖到棋盘」无意义；拖拽与 tap-tap 打的是同一命令。
 *
 * R10D（interaction #6）：与事件/市场同款的「钱不够」三通道——币不够
 * 车费时点车票 → 车票 180ms 横摇 + 价格宝石红闪 + 币条 HUD 轻跳，
 * 卡面「币不够了」做第二通道。上车本身从不被拒：赊账上车是合法规则
 * （待付夹），车门照常派发 PAY_BUS，只是不够币时顺手给币条跳一下——
 * 反馈一致但绝不挡路。
 */
import { useRef, useState } from 'react';
import { gameConfig } from '../config/gameConfig';
import { coinWord, strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { bumpCoinHud } from '../ui/hudNudge';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardView } from './CardView';
import { PlayableGlow } from './cards/PlayableGlow';
import { playSparkAt } from './cards/PlaySpark';
import { TiltCard } from './cards/TiltCard';
import { useDragPlay } from './cards/useDragPlay';
import type { DropZoneRef } from './cards/useDragPlay';

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
  const [picked, setPicked] = useState(false);
  // R10D：「钱不够」反馈计数——连点重播（key 带计数，重挂载重放动画）
  const [denyN, setDenyN] = useState(0);
  const doorRef = useRef<HTMLButtonElement | null>(null);

  const deny = () => {
    setDenyN((n) => n + 1);
    bumpCoinHud();
  };

  const pay = () => {
    // 币不够车费：赊账上车是合法规则——命令照派，只是上车前币条先
    // 跳一下（与事件/市场同一第三通道；车票在弹窗关掉前已摇过）
    if (!canPay && fee > 0) bumpCoinHud();
    playSparkAt(doorRef.current);
    send({ type: 'PAY_BUS' });
  };

  const drag = useDragPlay<null>({
    enabled: true,
    payload: null,
    zones: () => [{ id: 'door', el: doorRef.current, accepts: true }] as DropZoneRef[],
    onDrop: () => pay(),
  });
  const dragCls =
    `hand-drag bus-ticket-drag${denyN > 0 ? ' card-deny' : ''}` +
    `${drag.dragging ? ' hand-drag--up' : ''}${drag.shaking ? ' hand-drag--shake' : ''}`;

  const tapTicket = () => {
    if (!canPay && fee > 0) {
      // 点一张盖不住票价的卡 = 事件站「可点不可打」同款反馈
      deny();
      return;
    }
    setPicked((v) => !v);
  };

  return (
    <div className="panel-body">
      <div className="bus-stage">
        <div className={dragCls} ref={drag.ref} style={drag.style} key={denyN}>
          <PlayableGlow active sweepKey={`${state.lap}:${state.stationIndex}`}>
            <TiltCard
              glare
              front={
                <CardView
                  icon="🚌"
                  name={`${strings.panel.busTicket} · ${fee} ${coinWord(fee)}`}
                  price={fee > 0 ? fee : undefined}
                  tag={!canPay && fee > 0 ? strings.panel.noCoins : undefined}
                  selected={picked}
                  testid="action-ticket"
                  ariaLabel={label}
                  onClick={tapTicket}
                />
              }
            />
          </PlayableGlow>
        </div>
        <span className="bus-stage-arrow" aria-hidden="true">
          →
        </span>
        <Button
          variant="primary"
          innerRef={doorRef}
          className={`drop-zone drop-zone--door${picked ? ' drop-zone--armed' : ''}`}
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          speakText={label}
          onClick={pay}
        >
          <span className="dz-icon" aria-hidden="true">
            🚌
          </span>
          {label}
        </Button>
      </div>
      {me.busDebt > 0 && (
        <p className="panel-text">{fmt(strings.game.debtLeft, { n: me.busDebt })}</p>
      )}
      <p className="panel-keyhelp">{strings.bus.announced}</p>
    </div>
  );
}
