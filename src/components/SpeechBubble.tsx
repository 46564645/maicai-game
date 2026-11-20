/**
 * SpeechBubble.tsx —— bot→真人的提议气泡（G4）：从对应 bot 小卡下冒出，
 * 带「好呀 / 不用了」两个按钮。换菜（swap）与一起买邀请（invite）通用；
 * 引擎保证提议不发生币转移。
 */
import { useEffect, useRef } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { cardName, inviteSplitNote, playerDisplayName } from '../i18n/cardText';
import type { Player, Proposal } from '../game/types';
import { Button } from './Button';

export function SpeechBubble({
  from,
  proposal,
  onRespond,
}: {
  from: Player;
  proposal: Proposal;
  onRespond: (accept: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 竖屏下气泡在 bot 小卡下方、可能刚出视口：挂载时滚进来。
  // 提议浮签（.board-await）在场时它是第一回应面，滚动位由 Game.tsx
  // scrollRailToPill 统一管（滚到浮签所在的 .phone-turn 顶）——气泡是
  // 同命令的副入口，自己再 smooth 滚一次会和浮签抢滚动位、把浮签的
  // Yes/No 顶出栏口。
  useEffect(() => {
    if (document.querySelector('.board-await')) return;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const invite = proposal.inviteCardId
    ? cards.invites.find((i) => i.id === proposal.inviteCardId)
    : null;
  const text = invite
    ? fmt(strings.bubble.inviteAsk, { name: cardName(invite.id) })
    : fmt(strings.bubble.swapAsk, {
        give: cardName(proposal.giveCardId ?? ''),
        want: cardName(proposal.wantCardId ?? ''),
      });
  return (
    <div ref={ref} className="speech-bubble" data-testid="bubble-proposal">
      <p className="speech-bubble-from">
        {playerDisplayName(from)}
        {strings.bubble.fromSuffix}
      </p>
      <p className="speech-bubble-text">{text}</p>
      <p className="speech-bubble-note">{invite ? inviteSplitNote(invite) : strings.bubble.note}</p>
      <div className="speech-bubble-actions">
        <Button
          variant="primary"
          keyHint="1"
          data-testid="action-1"
          data-key={1}
          onClick={() => onRespond(true)}
        >
          {strings.buttons.agree}
        </Button>
        <Button
          variant="secondary"
          keyHint="2"
          data-testid="action-2"
          data-key={2}
          onClick={() => onRespond(false)}
        >
          {strings.buttons.decline}
        </Button>
      </div>
    </div>
  );
}
