/**
 * PartnerPanel.tsx —— 03 伙伴站（R10 Slice B）。
 * 两种待回应：
 * - inviteResponse：邀请卡以小扇弹入（giveCardId 的诱惑品插画），
 *   「好呀 / 不用了」两张选择卡成扇——点卡即回应 RESPOND_INVITE；
 *   好呀卡带每人价宝石，币不够置灰不可打。已加入计数胶囊保留。
 * - proposeSwap：真人主动发起一换一——我方/对方赠品菜 chips 全部升级
 *   为 TiltCard 小卡扇（食材插画）；点选规则同旧 chip（点选/焦点即选中），
 *   [确认提议] 发出 PROPOSE_SWAP；[1] 走完这一站（primary）。
 * 不借钱、不送钱：交换只动 extras，提议由引擎判定。
 */
import { useState } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { cardName, inviteSplitNote, inviteText, playerDisplayName } from '../i18n/cardText';
import type { CardId, Command, GameState, PlayerId } from '../game/types';
import { Button } from './Button';
import { CardView } from './CardView';
import { Hand } from './cards/Hand';
import { PlayableGlow } from './cards/PlayableGlow';
import { TiltCard } from './cards/TiltCard';
import type { HandItem } from './cards/Hand';

function cardIcon(id: CardId): string {
  return (
    cards.ingredients.find((i) => i.id === id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

/** 赠品菜选择卡（换菜用）：TiltCard 检视 + CardView；点选/焦点即选中 */
function PickCard({
  cardId,
  selected,
  testid,
  onPick,
}: {
  cardId: CardId;
  selected: boolean;
  testid: string;
  onPick: () => void;
}) {
  return (
    <TiltCard
      glare
      front={
        <CardView
          cardId={cardId}
          icon={cardIcon(cardId)}
          name={cardName(cardId)}
          selected={selected}
          testid={testid}
          ariaLabel={cardName(cardId)}
          onClick={onPick}
          onFocus={onPick}
        />
      }
    />
  );
}

/** 回应选择卡（邀请/通用二选）：PlayableGlow + TiltCard + CardView */
function ChoiceCard({
  icon,
  label,
  price,
  playable,
  testid,
  dataKey,
  primary,
  speakText,
  onPlay,
}: {
  icon: string;
  label: string;
  price?: number;
  playable: boolean;
  testid: string;
  dataKey: number;
  primary: boolean;
  speakText?: string;
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
            speakText={speakText}
            onClick={onPlay}
          />
        }
      />
    </PlayableGlow>
  );
}

export function PartnerPanel({
  state,
  send,
}: {
  state: GameState;
  send: (c: Command) => unknown;
}) {
  const me = state.players.find((p) => p.isHuman)!;
  const sub = state.turn?.sub;
  const pd = state.pendingDecision;
  const invite =
    sub?.kind === 'partner' ? cards.invites.find((i) => i.id === sub.inviteCardId) : null;

  const [giveIdx, setGiveIdx] = useState<number | null>(null);
  const [want, setWant] = useState<{ to: PlayerId; idx: number } | null>(null);

  /* —— 邀请卡回应：邀请卡 + 「好呀/不用了」两张选择卡 —— */
  if (pd.kind === 'inviteResponse' && invite && sub?.kind === 'partner') {
    const canJoin = me.coins >= invite.eachCost;
    const joined = sub.inviteAccepted.length;
    const choiceItems: HandItem[] = [
      {
        key: 'accept',
        node: (
          <ChoiceCard
            icon="👍"
            label={strings.buttons.agree}
            price={invite.eachCost}
            playable={canJoin}
            testid="action-primary"
            dataKey={1}
            primary
            speakText={`${strings.buttons.agree}, ${inviteText(invite)}`}
            onPlay={() =>
              send({ type: 'RESPOND_INVITE', proposalId: pd.proposalId, accept: true })
            }
          />
        ),
      },
      {
        key: 'decline',
        node: (
          <ChoiceCard
            icon="👋"
            label={strings.buttons.decline}
            playable
            testid="action-2"
            dataKey={2}
            primary={false}
            onPlay={() =>
              send({ type: 'RESPOND_INVITE', proposalId: pd.proposalId, accept: false })
            }
          />
        ),
      },
    ];
    return (
      <div className="panel-body">
        <div className="invite-stage" data-testid="invite-card">
          <TiltCard
            className="invite-tilt"
            glare
            front={
              <CardView
                cardId={invite.giveCardId}
                icon={invite.icon}
                name={cardName(invite.giveCardId)}
                tag={inviteSplitNote(invite)}
              />
            }
          />
          {/* 已加入的人：头像 + 计数「👦👧 1/2」；满 2 人就一起买（门槛【待确认】，不改） */}
          <span className="feature-card-note invite-count" data-testid="invite-count">
            <span aria-hidden="true">{strings.partner.inviteAvatars}</span>{' '}
            {fmt(strings.partner.inviteCount, { a: joined, b: invite.minPlayers })}
          </span>
        </div>
        <div className="panel-foot">
          <Hand
            className="choice-hand"
            items={choiceItems}
            ariaLabel={inviteText(invite)}
          />
          {!canJoin && (
            <p className="panel-text panel-selected">{strings.panel.noCoins}</p>
          )}
        </div>
      </div>
    );
  }

  /* —— 真人主动发起交换（两步选卡，全部小卡扇）—— */
  const giveCard = giveIdx !== null ? me.extras[giveIdx] : undefined;
  const wantCard =
    want !== null ? state.players.find((p) => p.id === want!.to)?.extras[want.idx] : undefined;
  const target = want !== null ? state.players.find((p) => p.id === want.to) : null;
  const ready = giveCard !== undefined && wantCard !== undefined && target !== null;
  const botsWithExtras = state.players.filter((p) => !p.isHuman && p.extras.length > 0);

  const myItems: HandItem[] = me.extras.map((id, i) => ({
    key: `give-${id}-${i}`,
    className: giveIdx === i ? 'hand-item--sel' : undefined,
    node: (
      <PickCard
        cardId={id}
        selected={giveIdx === i}
        testid={`action-give-${i}`}
        onPick={() => setGiveIdx(i)}
      />
    ),
  }));

  return (
    <div className="panel-body">
      {invite && sub?.kind === 'partner' && (
        <p className="panel-text">
          {cardName(invite.giveCardId)}　
          {strings.partner.inviteAvatars}{' '}
          {fmt(strings.partner.inviteCount, {
            a: sub.inviteAccepted.length,
            b: invite.minPlayers,
          })}
        </p>
      )}

      <p className="panel-subtitle">{strings.partner.myExtras}</p>
      {me.extras.length === 0 ? (
        <p className="panel-text">{strings.partner.noExtras}</p>
      ) : (
        <Hand
          className="swap-hand"
          items={myItems}
          ariaLabel={strings.partner.myExtras}
        />
      )}

      <p className="panel-subtitle">{strings.partner.theirExtras}</p>
      {botsWithExtras.length === 0 ? (
        <p className="panel-text">—</p>
      ) : (
        botsWithExtras.map((b) => {
          const theirItems: HandItem[] = b.extras.map((id, i) => ({
            key: `want-${b.id}-${id}-${i}`,
            className: want?.to === b.id && want.idx === i ? 'hand-item--sel' : undefined,
            node: (
              <PickCard
                cardId={id}
                selected={want?.to === b.id && want.idx === i}
                testid={`action-want-${b.id}-${i}`}
                onPick={() => setWant({ to: b.id, idx: i })}
              />
            ),
          }));
          return (
            <div className="swap-row" key={b.id}>
              <span className="swap-row-name">{playerDisplayName(b)}</span>
              <Hand
                className="swap-hand"
                items={theirItems}
                ariaLabel={`${playerDisplayName(b)} ${strings.partner.theirExtras}`}
              />
            </div>
          );
        })
      )}

      <p className="panel-text" aria-live="polite">
        {ready
          ? fmt(strings.partner.swapPicked, {
              give: cardName(giveCard!),
              name: playerDisplayName(target!),
              want: cardName(wantCard!),
            })
          : strings.partner.swapHint}
      </p>

      <div className="panel-foot">
        <div className="panel-actions">
          <Button
            variant="primary"
            keyHint="1"
            data-testid="action-primary"
            data-primary="true"
            data-key={1}
            onClick={() => send({ type: 'END_TURN' })}
          >
            {strings.panel.endTurn}
          </Button>
          <Button
            variant="secondary"
            keyHint="2"
            data-testid="action-2"
            data-key={2}
            disabled={!ready}
            onClick={() =>
              ready &&
              send({
                type: 'PROPOSE_SWAP',
                to: target!.id,
                giveCardId: giveCard!,
                wantCardId: wantCard!,
              })
            }
          >
            {strings.partner.swapConfirm}
          </Button>
        </div>
        <p className="panel-keyhelp">{strings.partner.noSwap}</p>
      </div>
    </div>
  );
}
