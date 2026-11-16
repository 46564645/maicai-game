/**
 * Game.tsx —— G1 主界面：顶条 + 8 站环路棋盘 + bot 左2右1 + 圈序卡 +
 * 底部真人区（菜谱/钱包/先等等/待付/求助牌）+ 站点弹窗宿主。
 * 弹窗按 pendingDecision 分派正式面板（DrawTask/Market/Bus/Cook/Store），
 * 未做面板的站回退 AutoPanel；bot→真人提议用 SpeechBubble 锚在对应小卡下。
 */
import { useEffect, useRef, useState } from 'react';
import { cards } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { coinWord, strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import type { Command, GameState, PlayerId } from '../game/types';
import { BoardMount } from '../board/BoardMount';
import { toBoardView } from '../board/boardModel';
import { usePhoneMode } from '../ui/usePhoneMode';
import { AutoPanel } from '../components/AutoPanel';
import { BotCard } from '../components/BotCard';
import { BusPanel } from '../components/BusPanel';
import { Button } from '../components/Button';
import { Coins } from '../components/Coins';
import { CookPanel } from '../components/CookPanel';
import { DrawTaskPanel } from '../components/DrawTaskPanel';
import { EventPanel } from '../components/EventPanel';
import { MarketPanel } from '../components/MarketPanel';
import { ParentPanel } from '../components/ParentPanel';
import { PartnerPanel } from '../components/PartnerPanel';
import { RecipeCard } from '../components/RecipeCard';
import { SpeechBubble } from '../components/SpeechBubble';
import { StationPopup } from '../components/StationPopup';
import { StorePanel } from '../components/StorePanel';
import { Toast } from '../components/Toast';

function playerIcon(characterId: string | null): string {
  return cards.characters.find((c) => c.id === characterId)?.icon ?? '🙂';
}

/** 站点编号圈字（G2：「② 菜市场摊位」） */
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧'];

export function Game({
  state,
  send,
  onOpenHelp,
  onOpenWallet,
}: {
  state: GameState;
  send: (c: Command) => unknown;
  onOpenHelp: () => void;
  onOpenWallet: () => void;
}) {
  const board = toBoardView(state);
  const human = state.players.find((p) => p.isHuman)!;
  const bots = state.players.filter((p) => !p.isHuman);
  // 手机只支持横屏（M4.5.6）：竖屏由 App 的旋转提示层盖住；
  // 横屏（874×402）= 左 2/3 岛 + 右竖栏（当前要做的事 + 大按钮）
  const phoneLand = usePhoneMode() === 'phone-landscape';
  const [openBot, setOpenBot] = useState<PlayerId | null>(null);
  // M4.5.8b：右竖栏吸底滚动——新一站/新决策打开时滚到底，让
  // 「买下 / 走完这一站」等主按钮整颗落在安全区内的栏底；内容
  // 变高（选中卡出现 Picked 行）时只要没上滚就继续吸底；孩子上滚
  // 看卡后放行，回来再滚到底即可点（不吸底覆盖、不挡点击）。
  const railRef = useRef<HTMLElement | null>(null);
  const stickBottom = useRef(true);
  // T0（M4.5.9 复验）：上次量到的栏高——内容增高前竖栏若还在底部
  // 160px 内，即使 scroll 事件已把 stickBottom 误锁为 false（scrollTop
  // 设定后、事件到达前内容又变高，onScroll 按旧高度算出「离底 ≥16px」；
  // 或点击前的 scroll-into-view 把竖栏带离底部几十 px），观察器也要
  // 据此恢复吸底，否则选中卡新增的 Picked 行会把「Done with this stop」
  // 留在屏底之外。恢复带 160px：卡片阅读区离面板底部 ≥150–200px，
  // 孩子主动上滚看卡不被误拉回。
  // 注：本轮 safearea 失败的主因是 popup-rise 入场动画的位移
  // （translateY 26px），已在 phone.css 竖栏内禁用；此处为次因加固。
  const lastScrollHeight = useRef(0);
  const railKey = `${state.lap}:${state.stationIndex}:${state.turn?.turnPhase ?? ''}:${state.pendingDecision.kind}`;
  const pinRail = () => {
    const rail = railRef.current;
    if (rail && stickBottom.current) rail.scrollTop = rail.scrollHeight;
  };
  useEffect(() => {
    stickBottom.current = true;
    const rail = railRef.current;
    if (!rail) return;
    // 有提议气泡时滚到气泡（它是当前要做的事）；否则钉到栏底露出主按钮
    const bubble = rail.querySelector('.speech-bubble');
    if (bubble) bubble.scrollIntoView({ block: 'end' });
    else rail.scrollTop = rail.scrollHeight;
    lastScrollHeight.current = rail.scrollHeight;
  }, [railKey]);
  // 弹窗可能与决策不同步挂载：任何重渲染后仍吸底就保持钉底
  useEffect(pinRail);
  // 非渲染驱动的高度变化（字体加载重排、子节点增删）由观察器兜底
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !phoneLand) return;
    const recoverPin = () => {
      // T0：增高前还在底部 160px 内（按上次栏高算）→ 恢复吸底并追到
      // 新底；孩子主动上滚看卡（离底更远）时不打扰。
      const wasNearBottom =
        rail.scrollTop + rail.clientHeight >= lastScrollHeight.current - 160;
      if (stickBottom.current || wasNearBottom) {
        stickBottom.current = true;
        rail.scrollTop = rail.scrollHeight;
      }
      lastScrollHeight.current = rail.scrollHeight;
    };
    const ro = new ResizeObserver(recoverPin);
    const mo = new MutationObserver(() => {
      for (const c of rail.children) ro.observe(c);
      recoverPin();
    });
    for (const c of rail.children) ro.observe(c);
    lastScrollHeight.current = rail.scrollHeight;
    mo.observe(rail, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [phoneLand]);
  const station = gameConfig.stations[state.stationIndex];
  const pd = state.pendingDecision;
  const pendingPid = 'playerId' in pd ? pd.playerId : null;
  const introPhase = state.turn?.turnPhase === 'intro';
  const humanPending = state.turn?.turnPhase === 'act' && pendingPid === state.humanId;
  const activePlayer = board.activePlayerId
    ? state.players.find((p) => p.id === board.activePlayerId)
    : null;
  const lastLog = state.log[state.log.length - 1];
  const pendingPlayer = pendingPid
    ? state.players.find((p) => p.id === pendingPid)
    : null;
  const orderNames = (state.turn?.order ?? [])
    .map((id) => state.players.find((p) => p.id === id)?.name ?? id)
    .join('→');

  // 发给真人的提议（伙伴站换菜/一起买）：锚在发起者的小卡下
  const proposal =
    pd.kind === 'swapResponse'
      ? state.proposals.find((p) => p.id === pd.proposalId)
      : undefined;
  const proposalFrom = proposal
    ? state.players.find((p) => p.id === proposal.from)
    : undefined;

  const renderBotSlot = (b: (typeof bots)[number]) => (
    <div className="bot-slot" key={b.id}>
      <BotCard player={b} thinking={board.activePlayerId === b.id} />
      {proposal && proposalFrom?.id === b.id && (
        <SpeechBubble
          from={proposalFrom}
          proposal={proposal}
          onRespond={(accept) =>
            send(
              proposal.kind === 'swap'
                ? { type: 'RESPOND_SWAP', proposalId: proposal.id, accept }
                : { type: 'RESPOND_INVITE', proposalId: proposal.id, accept },
            )
          }
        />
      )}
    </div>
  );

  const sub = state.turn?.sub;
  let panel = <AutoPanel state={state} send={send} />;
  switch (pd.kind) {
    case 'drawRecipe':
      panel = <DrawTaskPanel state={state} send={send} />;
      break;
    case 'marketTurn':
      panel = <MarketPanel state={state} send={send} />;
      break;
    case 'payBus':
      panel = <BusPanel state={state} send={send} />;
      break;
    case 'storeTurn':
      panel = <StorePanel state={state} send={send} />;
      break;
    case 'inviteResponse':
    case 'proposeSwap':
      panel = <PartnerPanel state={state} send={send} />;
      break;
    case 'eventOption':
      panel = <EventPanel state={state} send={send} />;
      break;
    case 'parentUse':
    case 'parentAnswer':
    case 'parentSettle':
      panel = <ParentPanel state={state} send={send} />;
      break;
    case 'ack':
      if (sub?.kind === 'drawTask') panel = <DrawTaskPanel state={state} send={send} />;
      else if (sub?.kind === 'cook') panel = <CookPanel state={state} send={send} />;
      break;
    default:
      break;
  }
  // 提议气泡自带两个按钮，不再开站点弹窗
  const showPopup = humanPending && pd.kind !== 'swapResponse';

  // 「轮到你了 / 进入这一站 + 状态行 + 最近一条日志」——
  // 桌面/平板放进棋盘 overlay；手机横屏放进右竖栏顶部
  const boardOverlay = introPhase ? (
    <>
      <p className="board-town">{strings.game.townAlt}</p>
      <p className="board-status">
        {pendingPid === state.humanId ? (
          <>
            {strings.game.yourTurn}:{' '}
            {fmt(strings.game.pawnAt, { name: station.name })}
          </>
        ) : (
          fmt(strings.game.botTurn, { name: pendingPlayer?.name ?? '' })
        )}
      </p>
      {pendingPid === state.humanId && (
        <Button
          variant="primary"
          className="board-enter"
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          onClick={() => send({ type: 'ACK' })}
        >
          <span>
            {strings.game.enterStation}
            <span className="btn-kbd-hint">{strings.game.enterStationKbd}</span>
          </span>
        </Button>
      )}
    </>
  ) : (
    <>
      <p className="board-town">{strings.game.townAlt}</p>
      <p className="board-status">
        {activePlayer
          ? activePlayer.isHuman
            ? strings.game.yourTurn
            : fmt(strings.game.botTurn, { name: activePlayer.name })
          : fmt(strings.game.pawnAt, { name: station.name })}
      </p>
      {lastLog && (
        <p className="board-log" aria-live="polite">
          {lastLog.text}
        </p>
      )}
    </>
  );

  const proposalEl = proposal && proposalFrom && (
    <SpeechBubble
      from={proposalFrom}
      proposal={proposal}
      onRespond={(accept) =>
        send(
          proposal.kind === 'swap'
            ? { type: 'RESPOND_SWAP', proposalId: proposal.id, accept }
            : { type: 'RESPOND_INVITE', proposalId: proposal.id, accept },
        )
      }
    />
  );

  const popupEl = showPopup ? (
    <StationPopup
      title={`${CIRCLED[state.stationIndex] ?? state.stationIndex + 1} ${station.name}`}
      testid={`panel-${station.id}`}
    >
      {panel}
    </StationPopup>
  ) : null;

  const botIcon = (b: (typeof bots)[number]) =>
    cards.bots.find((x) => x.id === b.characterId)?.icon ?? '●';

  return (
    <div
      className={'game-screen' + (phoneLand ? ' game-screen--phone-land' : '')}
      data-testid="screen-game"
    >
      {!phoneLand && (
        <header className="game-topbar">
          <h1 className="game-title">{strings.title}</h1>
          <div className="game-topbar-actions">
            <Button variant="secondary" disabled aria-label={strings.hud.settings}>
              {'⚙ ' + strings.hud.settings}
            </Button>
            <Button variant="secondary" onClick={onOpenHelp} aria-label={strings.hud.howTo}>
              {'? ' + strings.hud.howTo}
            </Button>
          </div>
        </header>
      )}

      <div className="game-layout">
        {!phoneLand && (
          <aside className="game-left">{bots.slice(0, 2).map(renderBotSlot)}</aside>
        )}

        <div className="game-board-area">
          {/* 手机横屏：overlay 内容挪进右竖栏（.phone-turn），画布左侧占 2/3 屏 */}
          <BoardMount {...board} compact={phoneLand}>
            {phoneLand ? null : boardOverlay}
          </BoardMount>
        </div>

        {!phoneLand && (
          <aside className="game-right">
            {bots.slice(2).map(renderBotSlot)}
            <div className="lap-card">
              <p className="lap-card-lap">
                {fmt(strings.hud.lapOf, { lap: state.lap, laps: gameConfig.laps })}
              </p>
              {orderNames && (
                <p className="lap-card-order">
                  {strings.hud.orderLabel}
                  {orderNames}
                </p>
              )}
            </div>
          </aside>
        )}

        {!phoneLand && (
          <footer className="game-bottom">
            <div className="me-avatar" aria-hidden="true">
              {playerIcon(human.characterId)}
              <span className="me-name">{human.name}</span>
            </div>
            <RecipeCard recipeId={human.recipeId} collected={human.collected} />
            <div className="me-coins">
              <Coins
                count={human.coins}
                label={fmt(strings.game.myCoins, { n: human.coins })}
              />
            </div>
            <button
              type="button"
              className="clip-chip"
              data-testid="btn-wallet"
              onClick={onOpenWallet}
              aria-label={strings.hud.wallet}
            >
              {strings.hud.wallet}
            </button>
            <div className="clip-chip clip-chip--hold">
              {strings.hud.holdClip}
              <span className="clip-chip-sub">
                {human.holdClip ? '1' : strings.hud.empty}
              </span>
            </div>
            <div className="clip-chip clip-chip--debt">
              {strings.hud.busDebt}
              <span className="clip-chip-sub">
                {human.busDebt > 0 ? `${human.busDebt} ${coinWord(human.busDebt)}` : strings.hud.empty}
              </span>
            </div>
            <button
              type="button"
              className="clip-chip clip-chip--help"
              data-testid="btn-help"
              onClick={onOpenHelp}
              aria-label={strings.hud.help}
            >
              {strings.hud.help}
              <span className="clip-chip-sub">{strings.hud.helpAnytime}</span>
            </button>
          </footer>
        )}
      </div>

      <Toast entries={state.log} />

      {phoneLand ? (
        <>
          {/* 左上：一圈小头像排（第几圈 + 3 个电脑人，点头像展开详情） */}
          <div className="phone-bots">
            <span className="phone-lap">
              {fmt(strings.hud.lapCompact, { lap: state.lap, laps: gameConfig.laps })}
            </span>
            {bots.map((b) => (
              <span className="phone-bot-wrap" key={b.id}>
                <button
                  type="button"
                  className={
                    'phone-bot' + (board.activePlayerId === b.id ? ' phone-bot--on' : '')
                  }
                  aria-expanded={openBot === b.id}
                  aria-label={fmt(strings.hud.botChip, { name: b.name, n: b.coins })}
                  onClick={() => setOpenBot(openBot === b.id ? null : b.id)}
                >
                  <span className="phone-bot-avatar" aria-hidden="true">
                    {botIcon(b)}
                  </span>
                  <span className="phone-bot-name">{b.name}</span>
                  <span className="phone-bot-coins" aria-hidden="true">
                    🪙{b.coins}
                  </span>
                </button>
                {openBot === b.id && (
                  <div className="phone-bot-pop">
                    <BotCard player={b} thinking={board.activePlayerId === b.id} />
                  </div>
                )}
              </span>
            ))}
          </div>

          {/* 右竖栏：轮到你了 + 当前这一站要做的事（弹窗收进栏里） */}
          <aside
            className="phone-rail"
            ref={railRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 16;
            }}
          >
            <div className="phone-turn">{boardOverlay}</div>
            {proposalEl}
            {popupEl}
          </aside>

          {/* 左下：钱包（永远显示币数）+ 求助牌 两个圆钮 */}
          <div className="phone-quick">
            <button
              type="button"
              className="phone-fab"
              data-testid="btn-wallet"
              onClick={onOpenWallet}
              aria-label={fmt(strings.hud.walletWithCoins, { n: human.coins })}
            >
              <span aria-hidden="true">🪙</span>
              <span className="phone-fab-num">{human.coins}</span>
              {human.busDebt > 0 && (
                <span className="phone-fab-badge" aria-label={strings.hud.busDebt}>
                  {human.busDebt}
                </span>
              )}
            </button>
            <button
              type="button"
              className="phone-fab phone-fab--help"
              data-testid="btn-help"
              onClick={onOpenHelp}
              aria-label={strings.hud.help}
            >
              <span aria-hidden="true">?</span>
            </button>
          </div>
        </>
      ) : (
        popupEl
      )}
    </div>
  );
}
