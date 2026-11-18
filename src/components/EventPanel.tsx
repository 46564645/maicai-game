/**
 * EventPanel.tsx —— 05 随机事件站（R10 Slice B）：天气转盘照旧演出；
 * 事件卡先入「牌堆翻牌」仪式——点牌堆、卡背顶卡翻开成事件卡
 * （TiltCard 翻面引擎，事件插画为卡面）；落定天气同时以小天气卡立在
 * 事件卡旁（weather 插画）。翻开后两个选择进扇形手牌：花钱卡带价格
 * 宝石、免费卡无宝石；点卡即打出 CHOOSE_EVENT_OPTION——命令、选项、
 * 键位（1=花钱 2=免费）与旧按钮流程完全一致；钱不够时花钱卡置灰
 * 不可打（不发命令、不发光）。
 */
import { useState } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { availableCommands } from '../game/selectors';
import { cardName, eventFreeLabel, eventSpendLabel, eventText } from '../i18n/cardText';
import type { Command, GameState } from '../game/types';
import { CardIcon } from './CardIcon';
import { CardView } from './CardView';
import { WeatherSpinner } from './WeatherSpinner';
import { Deck } from './cards/Deck';
import { Hand } from './cards/Hand';
import { PlayableGlow } from './cards/PlayableGlow';
import { TiltCard } from './cards/TiltCard';
import type { HandItem } from './cards/Hand';

/** 一张选择卡：PlayableGlow + TiltCard 检视 + CardView；点按即打出 */
function OptionCard({
  icon,
  label,
  price,
  playable,
  testid,
  dataKey,
  primary,
  onPlay,
}: {
  icon: string;
  label: string;
  price?: number;
  playable: boolean;
  testid: string;
  dataKey: number;
  primary: boolean;
  onPlay: () => void;
}) {
  return (
    <PlayableGlow active={playable} className={playable ? '' : 'pglow--dim'}>
      <TiltCard
        glare
        front={
          <CardView
            icon={icon}
            name={label}
            price={price}
            disabled={!playable}
            primary={primary}
            testid={testid}
            dataKey={dataKey}
            ariaLabel={label}
            speakText={label}
            onClick={onPlay}
          />
        }
      />
    </PlayableGlow>
  );
}

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
  const weather =
    sub?.kind === 'event'
      ? cards.weather.find((w) => w.id === sub.weatherId)
      : null;
  const cmds = availableCommands(state);
  const canSpend = cmds.some((c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'spend');
  const orderIdx = state.turn?.orderIndex ?? 0;
  const [revealed, setRevealed] = useState(false);

  if (!card || sub?.kind !== 'event') return null;

  const spendCard: HandItem = {
    key: 'opt-spend',
    node: (
      <OptionCard
        icon="🪙"
        label={eventSpendLabel(card)}
        price={card.spendOption.coins}
        playable={canSpend}
        testid={canSpend ? 'action-primary' : 'action-1'}
        dataKey={1}
        primary={canSpend}
        onPlay={() => send({ type: 'CHOOSE_EVENT_OPTION', option: 'spend' })}
      />
    ),
  };
  const freeCard: HandItem = {
    key: 'opt-free',
    node: (
      <OptionCard
        icon="🤲"
        label={eventFreeLabel(card)}
        playable
        testid={canSpend ? 'action-2' : 'action-primary'}
        dataKey={2}
        primary={!canSpend}
        onPlay={() => send({ type: 'CHOOSE_EVENT_OPTION', option: 'free' })}
      />
    ),
  };

  return (
    <div className="panel-body panel-body--event">
      <WeatherSpinner key={`${sub.weatherId}-${orderIdx}`} weatherId={sub.weatherId} />

      <div className="event-stage">
        {/* 落定天气：小天气卡立在边上（wth-* 插画已入册） */}
        {weather && (
          <div className="event-weather" data-testid="event-weather">
            <CardView
              cardId={weather.id}
              icon={weather.icon}
              name={cardName(weather.id)}
            />
          </div>
        )}
        {revealed ? (
          <div className="event-reveal" data-testid="event-card">
            <CardView
              cardId={card.id}
              icon={card.icon}
              name={cardName(card.id)}
            />
          </div>
        ) : (
          <Deck
            testid="action-primary"
            dataKey={1}
            ariaLabel={cardName(card.id)}
            face={
              <CardView cardId={card.id} icon={card.icon} name={cardName(card.id)} />
            }
            onDraw={() => setRevealed(true)}
          />
        )}
      </div>

      {revealed && (
        <>
          <p className="panel-text event-text">{eventText(card)}</p>
          <div className="panel-foot">
            <p className="panel-subtitle">
              <CardIcon icon={card.icon} /> {strings.event.choose}
            </p>
            <Hand
              className="event-hand"
              items={[spendCard, freeCard]}
              ariaLabel={strings.event.choose}
            />
            <p className="panel-keyhelp panel-keyhelp--kbd">{strings.panel.keyHelp}</p>
          </div>
        </>
      )}
    </div>
  );
}
