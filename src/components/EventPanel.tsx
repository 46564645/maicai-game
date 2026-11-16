/**
 * EventPanel.tsx —— 05 随机事件站：天气转盘 → 事件卡 → 花钱/不花钱二选一。
 * 花钱方案在币不够或已达每人上限时 disabled（availableCommands 为准）。
 */
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { availableCommands } from '../game/selectors';
import type { Command, GameState } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { WeatherSpinner } from './WeatherSpinner';

export function EventPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const sub = state.turn?.sub;
  const card =
    sub?.kind === 'event' ? cards.events.find((e) => e.id === sub.eventCardId) : null;
  const cmds = availableCommands(state);
  const canSpend = cmds.some((c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'spend');
  const orderIdx = state.turn?.orderIndex ?? 0;

  if (!card || sub?.kind !== 'event') return null;

  return (
    <div className="panel-body panel-body--event">
      <WeatherSpinner key={`${sub.weatherId}-${orderIdx}`} weatherId={sub.weatherId} />
      <div className="feature-card">
        <span className="feature-card-icon" aria-hidden="true">
          <CardIcon icon={card.icon} />
        </span>
        <span className="feature-card-name">{card.name}</span>
        <span className="feature-card-text">{card.text}</span>
      </div>
      <div className="panel-foot">
        <p className="panel-subtitle">{strings.event.choose}</p>
        <div className="panel-actions">
          <Button
            variant={canSpend ? 'primary' : 'secondary'}
            keyHint="1"
            data-testid={canSpend ? 'action-primary' : 'action-1'}
            data-primary={canSpend ? 'true' : undefined}
            data-key={1}
            disabled={!canSpend}
            speakText={card.spendOption.label}
            onClick={() => send({ type: 'CHOOSE_EVENT_OPTION', option: 'spend' })}
          >
            {card.spendOption.label}
          </Button>
          <Button
            variant={canSpend ? 'secondary' : 'primary'}
            keyHint="2"
            data-testid={canSpend ? 'action-2' : 'action-primary'}
            data-primary={canSpend ? undefined : 'true'}
            data-key={2}
            speakText={card.freeOption.label}
            onClick={() => send({ type: 'CHOOSE_EVENT_OPTION', option: 'free' })}
          >
            {card.freeOption.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
