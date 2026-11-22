/**
 * ProposalPill.tsx —— 等真人回应提议时的浮签卡（团队第 2 轮 ww 定稿，
 * 覆盖 R1 的「状态行 + 笼统短指令」方案）。
 *
 * bot 在伙伴站向真人发提议（换菜 swap / 一起买 invite）后，引擎停等
 * 真人回应。这张卡把提议写清：谁想用哪件换你的哪件（或想一起买哪件），
 * 配上两件菜的图，下面直接是 Yes（橙）/ No（藏青）两个 ≥48px 药丸
 * 按钮——孩子不用去角落找小气泡。角落气泡（SpeechBubble）只在本卡
 * 未挂载时作副入口（交互审 U3/U6：本卡在场即压掉气泡，同一问题
 * 只问一次、一对 Yes/No）；两边走同一条 RESPOND_SWAP / RESPOND_INVITE 命令。
 * 不设任何计时、不自动回应，等孩子自己点（团队第 2 轮更正）。
 *
 * 键位：Yes/No 挂 data-key 1/2（与气泡同编号、同命令）。桌面 ≥901px
 * 列内气泡放不下整颗（被底条裁边，见 hud.css）而 display:none——
 * 本卡接过键位成为唯一键盘面；手机栏内气泡可见时 1/2 首个命中落在
 * 栏内更靠前的本卡上，两条路径回同一条 RESPOND_* 命令。
 */
import { useEffect, useRef } from 'react';
import { cards, getIngredient } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { cardName, inviteSplitNote, playerDisplayName } from '../i18n/cardText';
import type { CardId, Player, Proposal } from '../game/types';
import { Button } from './Button';
import { CardIcon } from './CardIcon';
import { cardArtFor } from './cards/cardArt';
import { AnimatedContent } from './motion/AnimatedContent';
import { PlayableGlow } from './cards/PlayableGlow';

function ItemThumb({ id }: { id: CardId }) {
  const art = cardArtFor(id);
  const icon =
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    cards.invites.find((t) => t.id === id)?.icon ??
    '❔';
  return (
    <span className="board-await-thumb" data-thumb={id} aria-hidden="true">
      {art ? <img src={art} alt="" draggable={false} /> : <CardIcon icon={icon} />}
    </span>
  );
}

export function ProposalPill({
  from,
  proposal,
  onRespond,
}: {
  from: Player;
  proposal: Proposal;
  onRespond: (accept: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /* ≤900 单列（非触屏）时浮签随 boardOverlay 落在文档流中后段——挂载
     时滚进视野，Yes/No 不停留在首屏折线下（874×402 实测要滚 ~150px）；
     桌面底条/手机栏顶本就在视野内，block:'nearest' 零位移。手机栏内
     滚动位仍由 Game.tsx scrollRailToPill 对齐（同目标，后执行者生效）。 */
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const invite = proposal.inviteCardId
    ? cards.invites.find((i) => i.id === proposal.inviteCardId)
    : null;
  /* 手感审计 #4：到达提示——提议者的头像在浮签顶部弹一下（think-pop
     同款弹簧），告诉孩子「这是冲你来的问题」；扫光在 CSS 侧一次带过。
     纯演出：文案/按钮/命令一字不动。 */
  const avatar =
    cards.characters.find((c) => c.id === from.characterId)?.icon ??
    cards.bots.find((b) => b.id === from.characterId)?.icon ??
    '🙂';
  const text = invite
    ? fmt(strings.bubble.proposalInvite, {
        name: playerDisplayName(from),
        item: cardName(invite.id),
      })
    : fmt(strings.bubble.proposalSwap, {
        name: playerDisplayName(from),
        want: cardName(proposal.wantCardId ?? ''),
        give: cardName(proposal.giveCardId ?? ''),
      });
  /* WS4 D2：浮签进场改挂收编 AnimatedContent（滑入+轻弹落定）；
     到达扫光改用已收编 PlayableGlow 的 pglow-sweep（同一系统不另起
     炉灶）——sweepKey 按提议内容派生，新提议重播一次扫光。
     .board-await 语义类挪到 pglow 包裹盒上（flex 语境由
     .board-await-wrap / .board-await-in 附加规则接住），文案/缩略图/
     Yes·No 键位命令一字不动；按钮外观归 WS1 不管。 */
  const sweepKey = `${from.id}:${
    invite ? `i${invite.id}` : `s${proposal.wantCardId ?? ''}-${proposal.giveCardId ?? ''}`
  }`;
  return (
    <AnimatedContent className="board-await-wrap" distance={10}>
      <PlayableGlow active sweepKey={sweepKey} className="board-await">
        <div
          ref={ref}
          className="board-await-in"
          data-testid="await-proposal"
          aria-live="polite"
        >
          {/* F32（WS5）：头像弹入收编为 AnimatedContent 'pop'（SPRING_POP） */}
          <AnimatedContent
            variant="pop"
            className="board-await-avatar"
            ariaHidden
          >
            {avatar}
          </AnimatedContent>
          <p className="board-await-text">{text}</p>
          {/* 交互审 U6：邀请的分摊说明（inviteSplitNote）随浮签出，
              本卡是唯一回应面。消息减负审计 C3：换菜侧的「不借不
              送」提醒行删除——换菜面里根本没有金币选项（与 D3 同
              理）；邀请侧分摊说明保留（C2） */}
          {invite && (
            <p className="board-await-note">{inviteSplitNote(invite)}</p>
          )}
          <div className="board-await-thumbs" aria-hidden="true">
            {invite ? (
              <ItemThumb id={invite.id} />
            ) : (
              <>
                {/* 你的这件 ⇄ 对方的那件，与文案「your {want} for its {give}」同序 */}
                {proposal.wantCardId && <ItemThumb id={proposal.wantCardId} />}
                <span className="board-await-swap">⇄</span>
                {proposal.giveCardId && <ItemThumb id={proposal.giveCardId} />}
              </>
            )}
          </div>
          <div className="board-await-actions">
            <Button
              variant="primary"
              keyHint="1"
              data-testid="proposal-yes"
              data-key={1}
              onClick={() => onRespond(true)}
            >
              {strings.bubble.proposalYes}
            </Button>
            <Button
              variant="secondary"
              className="board-await-no"
              keyHint="2"
              data-testid="proposal-no"
              data-key={2}
              onClick={() => onRespond(false)}
            >
              {strings.bubble.proposalNo}
            </Button>
          </div>
        </div>
      </PlayableGlow>
    </AnimatedContent>
  );
}
