/**
 * SpeechBubble.tsx —— bot→真人的提议气泡（G4）：从对应 bot 小卡下冒出，
 * 带「好呀 / 不用了」两个按钮。换菜（swap）与一起买邀请（invite）通用；
 * 引擎保证提议不发生币转移。
 */
import { useEffect, useRef } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { cardName, fmt } from '../game/stations/shared';
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
  // 竖屏下气泡在 bot 小卡下方、可能刚出视口：挂载时滚进来
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const invite = proposal.inviteCardId
    ? cards.invites.find((i) => i.id === proposal.inviteCardId)
    : null;
  const text = invite
    ? fmt(strings.bubble.inviteAsk, { name: invite.name })
    : fmt(strings.bubble.swapAsk, {
        give: cardName(proposal.giveCardId ?? ''),
        want: cardName(proposal.wantCardId ?? ''),
      });
  return (
    <div ref={ref} className="speech-bubble" data-testid="bubble-proposal">
      <p className="speech-bubble-from">
        {from.name}
        {strings.bubble.fromSuffix}
      </p>
      <p className="speech-bubble-text">{text}</p>
      <p className="speech-bubble-note">{invite?.splitNote ?? strings.bubble.note}</p>
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
