/**
 * EventPanel.tsx —— 05 随机事件站（R10 Slice B）：天气转盘照旧演出；
 * 事件卡先入「牌堆翻牌」仪式——点牌堆、卡背顶卡翻开成事件卡
 * （TiltCard 翻面引擎，事件插画为卡面）；落定天气同时以小天气卡立在
 * 事件卡旁（weather 插画）。翻开后两个选择进扇形手牌：花钱卡带价格
 * 宝石、免费卡无宝石；点卡即打出 CHOOSE_EVENT_OPTION——命令、选项、
 * 键位（1=花钱 2=免费）与旧按钮流程完全一致；钱不够时花钱卡置灰
 * 不可打（不发命令、不发光）。
 */
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
import { PendingChip } from './cards/PendingChip';
import { PlayableGlow } from './cards/PlayableGlow';
import { TiltCard } from './cards/TiltCard';
import { usePending } from './cards/usePending';
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
  revealed,
  onReveal,
}: {
  state: GameState;
  send: (c: Command) => unknown;
  /** R10C（play #1）：翻开状态上移到 Game——它要用它压制翻牌前的
      剧透 toast（「转到XX：『事件名』」在翻开完成前不该上屏） */
  revealed: boolean;
  onReveal: () => void;
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
  // R10C 后悔窗口：花钱方案挂起 ~1.5s（撤销片回收），免费方案即时
  const pending = usePending();

  if (!card || sub?.kind !== 'event') return null;
  const busy = pending.pendingLabel !== null;
  const commit = (option: 'spend' | 'free') => {
    if (option === 'spend') {
      pending.arm(eventSpendLabel(card), () =>
        send({ type: 'CHOOSE_EVENT_OPTION', option: 'spend' }),
      );
    } else send({ type: 'CHOOSE_EVENT_OPTION', option: 'free' });
  };

  const spendCard: HandItem = {
    key: 'opt-spend',
    node: (
      <OptionCard
        icon="🪙"
        label={eventSpendLabel(card)}
        price={card.spendOption.coins}
        playable={canSpend && !busy}
        testid={canSpend ? 'action-primary' : 'action-1'}
        dataKey={1}
        primary={canSpend}
        onPlay={() => commit('spend')}
      />
    ),
  };
  const freeCard: HandItem = {
    key: 'opt-free',
    node: (
      <OptionCard
        icon="🤲"
        label={eventFreeLabel(card)}
        playable={!busy}
        testid={canSpend ? 'action-2' : 'action-primary'}
        dataKey={2}
        primary={!canSpend}
        onPlay={() => commit('free')}
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
          /* R10C（play #1）：一张大的故事卡——事件美术 + 完整故事正文，
             两个选项卡在下面整幅可读（≤3 张扇不重叠，名字不截断） */
          <div className="event-story" data-testid="event-card">
            <div className="event-story-art">
              <CardView
                cardId={card.id}
                icon={card.icon}
                name={cardName(card.id)}
              />
            </div>
            <p className="event-story-text">{eventText(card)}</p>
          </div>
        ) : (
          <Deck
            testid="action-primary"
            dataKey={1}
            ariaLabel={strings.event.deckHint}
            hint={strings.event.deckHint}
            face={
              <CardView cardId={card.id} icon={card.icon} name={cardName(card.id)} />
            }
            onDraw={onReveal}
          />
        )}
      </div>

      {revealed && (
        <>
          <div className="panel-foot">
            <p className="panel-subtitle">
              <CardIcon icon={card.icon} /> {strings.event.choose}
            </p>
            {pending.pendingLabel !== null && (
              <PendingChip label={pending.pendingLabel} onCancel={pending.cancel} />
            )}
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
