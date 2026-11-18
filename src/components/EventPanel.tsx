/**
 * EventPanel.tsx —— 05 随机事件站（R10 Slice B）：天气转盘照旧演出；
 * 事件卡先入「牌堆翻牌」仪式——点牌堆、卡背顶卡翻开成事件卡
 * （TiltCard 翻面引擎，事件插画为卡面）；落定天气同时以小天气卡立在
 * 事件卡旁（weather 插画）。翻开后两个选择进扇形手牌：花钱卡带价格
 * 宝石、免费卡无宝石；点卡即打出 CHOOSE_EVENT_OPTION——命令、选项、
 * 键位（1=花钱 2=免费）与旧按钮流程完全一致。
 * R10D：花钱卡带余款预告（花 p 币 · 还剩 n 币）；两个方案都进后悔
 * 窗口，窗口里播「后果回声」（买菜钱还够 / 差 n 币 / 一个币没花）。
 * 钱不够时花钱卡仍可点——点出 shake+宝石红闪+币条轻跳（不发命令），
 * 「币不够了」标签做第二通道（interaction #6）。
 */
import { useEffect, useState } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { availableCommands, missingCost } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { cardName, eventFreeLabel, eventSpendLabel, eventText } from '../i18n/cardText';
import { eventEchoKind } from '../ui/eventEcho';
import { bumpCoinHud } from '../ui/hudNudge';
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

/** 一张选择卡：PlayableGlow + TiltCard 检视 + CardView；点按即打出。
 *  R10D：卡面 tag 位（宝石下/横幅下）给余款预告或「币不够了」；
 *  denying 时整卡 180ms 横摇 + 价格宝石红闪一次。卡永远不禁用——
 *  「可点不可打」由 onPlay 内部判别（买不起 → deny 反馈，不发令）。 */
function OptionCard({
  icon,
  label,
  price,
  playable,
  denying,
  tag,
  testid,
  dataKey,
  primary,
  onPlay,
}: {
  icon: string;
  label: string;
  price?: number;
  playable: boolean;
  /** R10D：本卡正在播「钱不够」反馈（摇+闪，类名带计数重播） */
  denying?: number;
  /** R10D：卡面小字（余款预告 / 币不够了） */
  tag?: string;
  testid: string;
  dataKey: number;
  primary: boolean;
  onPlay: () => void;
}) {
  return (
    <PlayableGlow
      active={playable}
      className={
        (playable ? '' : 'pglow--dim') + (denying ? ' card-deny' : '')
      }
      key={denying ?? 0}
    >
      <TiltCard
        glare
        front={
          <CardView
            icon={icon}
            name={label}
            price={price}
            tag={tag}
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
  const me = state.players.find((p) => p.isHuman)!;
  const cmds = availableCommands(state);
  const canSpend = cmds.some((c) => c.type === 'CHOOSE_EVENT_OPTION' && c.option === 'spend');
  const orderIdx = state.turn?.orderIndex ?? 0;
  // R10C 后悔窗口：花钱方案挂起 ~1.5s（撤销片回收）
  // R10D：免费方案同挂窗口——窗口期=「后果回声」的播报位，也是误触收回位
  const pending = usePending();
  const [echo, setEcho] = useState<{ text: string; warn: boolean } | null>(null);
  // denyN 记「哪张卡被拒+第几次」——动画 key 带计数，连点重播
  const [denyN, setDenyN] = useState<{ opt: 'spend' | 'free'; n: number }>({
    opt: 'spend',
    n: 0,
  });

  // 后悔窗口开→关（命令落地或撤销）时回声同步收掉
  useEffect(() => {
    if (pending.pendingLabel === null) setEcho(null);
  }, [pending.pendingLabel]);

  if (!card || sub?.kind !== 'event') return null;
  const busy = pending.pendingLabel !== null;
  const price = card.spendOption.coins ?? 0;
  // R10D 回声判定（纯函数）：花后是否还够买菜钱（菜谱缺口=市场价合计）
  const coinsAfter = me.coins - price;
  const gap = missingCost(me);

  /** 「可点不可打」：买不起/后悔窗口占用中再点 → 摇+闪+币条跳，不发令 */
  const deny = (opt: 'spend' | 'free') => {
    setDenyN((d) => ({ opt, n: d.opt === opt ? d.n + 1 : 1 }));
    bumpCoinHud();
  };

  const commit = (option: 'spend' | 'free') => {
    if (option === 'spend') {
      if (!canSpend || busy) {
        deny('spend');
        return;
      }
      if (
        pending.arm(eventSpendLabel(card), () =>
          send({ type: 'CHOOSE_EVENT_OPTION', option: 'spend' }),
        )
      ) {
        const kind = eventEchoKind(price, coinsAfter, gap);
        setEcho(
          kind === 'spendOk'
            ? { text: fmt(strings.event.echoSpendOk, { p: price }), warn: false }
            : { text: fmt(strings.event.echoSpendGap, { n: gap - coinsAfter }), warn: true },
        );
      }
    } else {
      if (busy) {
        deny('free');
        return;
      }
      if (
        pending.arm(eventFreeLabel(card), () =>
          send({ type: 'CHOOSE_EVENT_OPTION', option: 'free' }),
        )
      ) {
        setEcho({ text: strings.event.echoFree, warn: false });
      }
    }
  };

  const spendCard: HandItem = {
    key: 'opt-spend',
    name: eventSpendLabel(card),
    speakText: eventSpendLabel(card),
    node: (
      <OptionCard
        icon="🪙"
        label={eventSpendLabel(card)}
        price={price}
        playable={canSpend && !busy}
        denying={denyN.opt === 'spend' ? denyN.n : 0}
        tag={
          canSpend
            ? fmt(strings.event.spendPreview, { p: price, n: coinsAfter })
            : strings.panel.noCoins
        }
        testid={canSpend ? 'action-primary' : 'action-1'}
        dataKey={1}
        primary={canSpend}
        onPlay={() => commit('spend')}
      />
    ),
  };
  const freeCard: HandItem = {
    key: 'opt-free',
    name: eventFreeLabel(card),
    speakText: eventFreeLabel(card),
    node: (
      <OptionCard
        icon="🤲"
        label={eventFreeLabel(card)}
        playable={!busy}
        denying={denyN.opt === 'free' ? denyN.n : 0}
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
            {/* R10D（education #7）：后悔窗口里播「后果回声」——花了币
                买菜钱还够不够 / 一个币没花留给后面；窗口关（落地或撤销）
                回声同步收掉 */}
            {pending.pendingLabel !== null && (
              <PendingChip label={pending.pendingLabel} onCancel={pending.cancel} />
            )}
            {echo !== null && (
              <p
                className={'panel-echo' + (echo.warn ? ' panel-echo--warn' : '')}
                role="status"
                data-testid="event-echo"
              >
                {echo.text}
              </p>
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
