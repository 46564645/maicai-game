/**
 * PartnerPanel.tsx —— 03 伙伴站。
 * 两种待回应：
 * - inviteResponse：邀请卡区（卡面 + splitNote + 已加入 n/minPlayers）→ 好呀/不用了
 * - proposeSwap：真人主动发起一换一——先点「我多余的菜」，再点想换的菜，
 *   [确认提议] 发出 PROPOSE_SWAP；[1] 走完这一站（primary）。
 * 不借钱、不送钱：交换只动 extras，提议由引擎判定。
 */
import { useState } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { cardName, fmt } from '../game/stations/shared';
import type { CardId, Command, GameState, PlayerId } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';

function cardIcon(id: CardId): string {
  return (
    cards.ingredients.find((i) => i.id === id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

/** 可选 chip（赠品菜）：选中高亮，焦点落入即选中（键盘 ←→ 可达） */
function Chip({
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
    <button
      type="button"
      className={'chip' + (selected ? ' chip--selected' : '')}
      data-testid={testid}
      aria-pressed={selected}
      aria-label={cardName(cardId)}
      onClick={onPick}
      onFocus={onPick}
    >
      <span aria-hidden="true">
        <CardIcon icon={cardIcon(cardId)} />
      </span>
      {cardName(cardId)}
    </button>
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

  /* —— 邀请卡回应 —— */
  if (pd.kind === 'inviteResponse' && invite && sub?.kind === 'partner') {
    const canJoin = me.coins >= invite.eachCost;
    const joined = sub.inviteAccepted.length;
    return (
      <div className="panel-body">
        <div className="feature-card" data-testid="invite-card">
          <span className="feature-card-icon" aria-hidden="true">
            <CardIcon icon={invite.icon} />
          </span>
          {/* 只写买的是什么：图标 + 一个词（冰棍/贴纸），不再有「邀请卡 · …」那行 */}
          <span className="feature-card-name">{cardName(invite.giveCardId)}</span>
          <span className="feature-card-text">{invite.splitNote}</span>
          {/* 已加入的人：头像 + 计数「👦👧 1/2」；满 2 人就一起买（门槛【待确认】，不改） */}
          <span className="feature-card-note invite-count" data-testid="invite-count">
            <span aria-hidden="true">{strings.partner.inviteAvatars}</span>{' '}
            {fmt(strings.partner.inviteCount, { a: joined, b: invite.minPlayers })}
          </span>
        </div>
        <div className="panel-foot">
          <div className="panel-actions">
            <Button
              variant="primary"
              keyHint="1"
              data-testid="action-primary"
              data-primary="true"
              data-key={1}
              disabled={!canJoin}
              speakText={`${strings.buttons.agree}, ${invite.text}`}
              onClick={() =>
                send({ type: 'RESPOND_INVITE', proposalId: pd.proposalId, accept: true })
              }
            >
              {strings.buttons.agree}
            </Button>
            <Button
              variant="secondary"
              keyHint="2"
              data-testid="action-2"
              data-key={2}
              onClick={() =>
                send({ type: 'RESPOND_INVITE', proposalId: pd.proposalId, accept: false })
              }
            >
              {strings.buttons.decline}
            </Button>
          </div>
          {!canJoin && (
            <p className="panel-text panel-selected">{strings.panel.noCoins}</p>
          )}
        </div>
      </div>
    );
  }

  /* —— 真人主动发起交换（两步选卡）—— */
  const giveCard = giveIdx !== null ? me.extras[giveIdx] : undefined;
  const wantCard =
    want !== null ? state.players.find((p) => p.id === want!.to)?.extras[want.idx] : undefined;
  const target = want !== null ? state.players.find((p) => p.id === want.to) : null;
  const ready = giveCard !== undefined && wantCard !== undefined && target !== null;
  const botsWithExtras = state.players.filter((p) => !p.isHuman && p.extras.length > 0);

  return (
    <div className="panel-body">
      {invite && sub?.kind === 'partner' && (
        <p className="panel-text">
          <CardIcon icon={invite.icon} /> {cardName(invite.giveCardId)}　
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
        <div className="chip-row">
          {me.extras.map((id, i) => (
            <Chip
              key={`${id}-${i}`}
              cardId={id}
              selected={giveIdx === i}
              testid={`action-give-${i}`}
              onPick={() => setGiveIdx(i)}
            />
          ))}
        </div>
      )}

      <p className="panel-subtitle">{strings.partner.theirExtras}</p>
      {botsWithExtras.length === 0 ? (
        <p className="panel-text">—</p>
      ) : (
        botsWithExtras.map((b) => (
          <div className="swap-row" key={b.id}>
            <span className="swap-row-name">{b.name}</span>
            <div className="chip-row">
              {b.extras.map((id, i) => (
                <Chip
                  key={`${id}-${i}`}
                  cardId={id}
                  selected={want?.to === b.id && want.idx === i}
                  testid={`action-want-${b.id}-${i}`}
                  onPick={() => setWant({ to: b.id, idx: i })}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <p className="panel-text" aria-live="polite">
        {ready
          ? fmt(strings.partner.swapPicked, {
              give: cardName(giveCard!),
              name: target!.name,
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
