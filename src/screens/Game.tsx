/**
 * Game.tsx —— G1 主界面：顶条 + 8 站环路棋盘 + bot 左2右1 + 圈序卡 +
 * 底部真人区（菜谱/钱包/先等等/待付/求助牌）+ 站点弹窗宿主。
 * 弹窗按 pendingDecision 分派正式面板（DrawTask/Market/Bus/Cook/Store），
 * 未做面板的站回退 AutoPanel；bot→真人提议用 SpeechBubble 锚在对应小卡下。
 */
import { useEffect, useRef, useState } from 'react';
import { cards, getIngredient } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { coinWord, strings } from '../data/strings';
import { fmt, marketPriceOf } from '../game/stations/shared';
import type { Command, GameState, PlayerId } from '../game/types';
import { BoardMount } from '../board/BoardMount';
import { toBoardView } from '../board/boardModel';
import { LangToggle } from '../i18n/LangToggle';
import { cardName, playerDisplayName, stationName } from '../i18n/cardText';
import { botThinkLine } from '../ui/botThink';
import { usePhoneMode } from '../ui/usePhoneMode';
import { AutoPanel } from '../components/AutoPanel';
import { BotCard } from '../components/BotCard';
import { BusPanel } from '../components/BusPanel';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
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
import { CoinCounter } from '../components/cards/CoinCounter';
import { Hand } from '../components/cards/Hand';

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
  // R10C（play #1）：事件卡翻开状态上移——翻牌完成前，toast/board-log
  // 里的「转到XX：『事件名』」日志是剧透，压到翻开后再上屏
  const [eventRevealed, setEventRevealed] = useState(false);
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
    if (rail && stickBottom.current) {
      rail.scrollTop = rail.scrollHeight;
      // R10C：内容还会长（弹窗内嵌结构在钉底后再撑高 ~146px）——
      // 钉底的 scroll 事件带着旧高度到达时会先把 stickBottom 误锁，
      // 再补一帧复钉，缩短「底按钮悬在安全区下沿外」的过渡窗口。
      requestAnimationFrame(() => {
        if (stickBottom.current) rail.scrollTop = rail.scrollHeight;
      });
    }
  };
  useEffect(() => {
    stickBottom.current = true;
    setEventRevealed(false);
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
    // subtree：弹窗内部内容再撑高（如金币条/选中行补进 foot）也算
    // 高度变化——只看直接子节点会漏掉，恢复要等 RO 的下一帧才追上
    mo.observe(rail, { childList: true, subtree: true });
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
  // R10C：人类玩家的事件卡还盖着时，最后一条日志就是剧透——
  // toast 与 board-log 一律跳过它（引擎 log 本身不动）
  const eventVeiled =
    humanPending && pd.kind === 'eventOption' && !eventRevealed;
  const shownLog = eventVeiled
    ? (state.log[state.log.length - 2] ?? null)
    : lastLog;
  const pendingPlayer = pendingPid
    ? state.players.find((p) => p.id === pendingPid)
    : null;
  const orderNames = (state.turn?.order ?? [])
    .map((id) => {
      const p = state.players.find((x) => x.id === id);
      return p ? playerDisplayName(p) : id;
    })
    .join('→');

  // 发给真人的提议（伙伴站换菜/一起买）：锚在发起者的小卡下
  const proposal =
    pd.kind === 'swapResponse'
      ? state.proposals.find((p) => p.id === pd.proposalId)
      : undefined;
  const proposalFrom = proposal
    ? state.players.find((p) => p.id === proposal.from)
    : undefined;

  const renderBotSlot = (b: (typeof bots)[number]) => {
    // R10C（education #3）：bot 心里话气泡——最新一条日志归它时，
    // 用 spend.kind + 性格映成一句短理由（复用日志时序，不加事件）
    const think = botThinkLine(b, lastLog);
    return (
      <div className="bot-slot" key={b.id}>
        <BotCard player={b} thinking={board.activePlayerId === b.id} />
        {think && (
          <p className="think-bubble" key={lastLog.id}>
            {think}
          </p>
        )}
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
  };

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
      panel = (
        <EventPanel
          state={state}
          send={send}
          revealed={eventRevealed}
          onReveal={() => setEventRevealed(true)}
        />
      );
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
            {fmt(strings.game.pawnAt, { name: stationName(station.id) })}
          </>
        ) : (
          fmt(strings.game.botTurn, {
            name: pendingPlayer ? playerDisplayName(pendingPlayer) : '',
          })
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
            : fmt(strings.game.botTurn, { name: playerDisplayName(activePlayer) })
          : fmt(strings.game.pawnAt, { name: stationName(station.id) })}
      </p>
      {shownLog && (
        <p className="board-log" aria-live="polite">
          {shownLog.text}
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
      title={`${CIRCLED[state.stationIndex] ?? state.stationIndex + 1} ${stationName(station.id)}`}
      testid={`panel-${station.id}`}
    >
      {panel}
    </StationPopup>
  ) : null;

  const botIcon = (b: (typeof bots)[number]) =>
    cards.bots.find((x) => x.id === b.characterId)?.icon ?? '●';

  // —— R10：底栏常驻手牌（菜谱任务卡 + 留菜夹卡）——
  // 非真人回合整手压暗（§3.2 dimmed）；手机横屏无底栏，常驻卡不进右栏
  // （与本栏旧表现一致，见 R10_DESIGN Slice A 记录）。
  const myCoinsLabel = fmt(strings.game.myCoins, { n: human.coins });
  const holdClipInfo =
    human.holdClip !== null
      ? (getIngredient(human.holdClip) ??
        cards.temptations.find((t) => t.id === human.holdClip) ??
        null)
      : null;
  const meHandItems = [
    ...(human.recipeId
      ? [
          {
            key: `recipe-${human.recipeId}`,
            className: 'hand-item--quest',
            node: (
              <RecipeCard recipeId={human.recipeId} collected={human.collected} />
            ),
          },
        ]
      : []),
    ...(human.holdClip && holdClipInfo
      ? [
          {
            key: `hold-${human.holdClip}`,
            node: (
              <CardView
                cardId={human.holdClip}
                icon={holdClipInfo.icon}
                name={cardName(human.holdClip)}
                price={marketPriceOf(human.holdClip) ?? undefined}
                tag={strings.buttons.hold}
              />
            ),
          },
        ]
      : []),
  ];

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
            <LangToggle />
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
              <span className="me-avatar-icon">{playerIcon(human.characterId)}</span>
              <span className="me-name">{playerDisplayName(human)}</span>
            </div>
            {/* R10：常驻卡进手牌扇——菜谱任务卡 + 留菜夹卡（抽到菜谱时
                新卡以 quest-land 翻落入手；free 档各卡自然宽） */}
            <div className="me-hand">
              <Hand
                layout="free"
                dimmed={!humanPending}
                items={meHandItems}
                ariaLabel={strings.hud.basket}
              />
            </div>
            <div className="me-coins">
              <Coins
                count={human.coins}
                label={myCoinsLabel}
                counter={<CoinCounter value={human.coins} label={myCoinsLabel} />}
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

      <Toast entries={eventVeiled ? state.log.slice(0, -1) : state.log} />

      {phoneLand ? (
        <>
          {/* 左上：一圈小头像排（第几圈 + 3 个电脑人，点头像展开详情） */}
          <div className="phone-bots">
            <span className="phone-lap">
              {fmt(strings.hud.lapCompact, { lap: state.lap, laps: gameConfig.laps })}
            </span>
            {bots.map((b) => (
              <span className="phone-bot-wrap" key={b.id}>
                {/* R10C：心里话气泡也贴到手机小头像上 */}
                {(() => {
                  const t = botThinkLine(b, lastLog);
                  return t ? (
                    <span className="think-bubble think-bubble--phone" key={lastLog.id}>
                      {t}
                    </span>
                  ) : null;
                })()}
                <button
                  type="button"
                  className={
                    'phone-bot' + (board.activePlayerId === b.id ? ' phone-bot--on' : '')
                  }
                  data-bot={b.characterId ?? undefined}
                  aria-expanded={openBot === b.id}
                  aria-label={fmt(strings.hud.botChip, { name: playerDisplayName(b), n: b.coins })}
                  onClick={() => setOpenBot(openBot === b.id ? null : b.id)}
                >
                  <span className="phone-bot-avatar" aria-hidden="true">
                    {botIcon(b)}
                  </span>
                  <span className="phone-bot-name">{playerDisplayName(b)}</span>
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
            <LangToggle />
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
              <span className="phone-fab-num">
                <CoinCounter
                  value={human.coins}
                  label={fmt(strings.hud.walletWithCoins, { n: human.coins })}
                />
              </span>
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
