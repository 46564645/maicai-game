/**
 * Game.tsx —— G1 主界面：顶条 + 8 站环路棋盘 + bot 左2右1 + 圈序卡 +
 * 底部真人区（菜谱/钱包/先等等/待付/求助牌）+ 站点弹窗宿主。
 * 弹窗按 pendingDecision 分派正式面板（DrawTask/Market/Bus/Cook/Store），
 * 未做面板的站回退 AutoPanel；bot→真人提议用 SpeechBubble 锚在对应小卡下。
 */
import { useEffect, useRef, useState } from 'react';
import { cards, getIngredient, getRecipe } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { strings } from '../data/strings';
import { fmt, marketPriceOf } from '../game/stations/shared';
import type { CardId, Command, GameState, Player, PlayerId } from '../game/types';
import { BoardMount } from '../board/BoardMount';
import { toBoardView } from '../board/boardModel';
import { LangToggle } from '../i18n/LangToggle';
import { cardName, localizeLogText, playerDisplayName, stationGoal, stationName } from '../i18n/cardText';
import { awaitingHumanKind } from '../ui/awaitingHuman';
import { lapGainOf } from '../ui/lapGain';
import { botThinkLine } from '../ui/botThink';
import { botTrait } from '../ui/botTrait';
import { nextActorId } from '../ui/nextActor';
import { spotlightInfo } from '../ui/spotlight';
import { fastForwardBotTurn } from '../ui/botTiming';
import { botWeatherSettleMs, weatherDressFor } from '../ui/weatherMoment';
import { usePhoneMode } from '../ui/usePhoneMode';
import { AutoPanel } from '../components/AutoPanel';
import { BotCard } from '../components/BotCard';
import { BusPanel } from '../components/BusPanel';
import { Button } from '../components/Button';
import { CardView } from '../components/CardView';
import { CoinDots } from '../components/CoinDots';
import { CookPanel } from '../components/CookPanel';
import { DrawTaskPanel } from '../components/DrawTaskPanel';
import { EventPanel } from '../components/EventPanel';
import { MarketPanel } from '../components/MarketPanel';
import { ParentPanel } from '../components/ParentPanel';
import { PartnerPanel } from '../components/PartnerPanel';
import { ProposalPill } from '../components/ProposalPill';
import { RecipeCard } from '../components/RecipeCard';
import { SpeechBubble } from '../components/SpeechBubble';
import { PopupOutlet, StationPopup } from '../components/StationPopup';
import type { RecipeStripItem } from '../components/StationPopup';
import { StorePanel } from '../components/StorePanel';
import { Toast } from '../components/Toast';
import { CoinCounter } from '../components/cards/CoinCounter';
import { Hand } from '../components/cards/Hand';
import { ProfileCard } from '../components/cards/ProfileCard';

function playerIcon(characterId: string | null): string {
  return cards.characters.find((c) => c.id === characterId)?.icon ?? '🙂';
}

/** 任意玩家（真人角色卡/bot 性格卡）的头像图标 */
function avatarIcon(p: Player): string {
  return (
    cards.characters.find((c) => c.id === p.characterId)?.icon ??
    cards.bots.find((b) => b.id === p.characterId)?.icon ??
    '🙂'
  );
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
  /* R10E（§3）：ProfileCard 高光时刻——点徽章/小头像弹全屏卡；
     R1-E3 改：轮到 bot 的 auto 高光不再是全屏帘，改为角落小卡
     （BotCard/手机头像片的 --spot 态）亮约 1s 自收，不挡操作；
     manual=孩子点的全屏卡（不自动收），auto=轮流到点自收 */
  const [spot, setSpot] = useState<{ id: PlayerId; manual: boolean } | null>(
    null,
  );
  /* R10E（§2 天气布景）：孩子点掉大天气卡（或 bot 转盘落定）后，
     给世界换上对应天气——DOM 洗色走 .game-screen.weather--*，
     3D 灯光/雨丝/云速走 board.weatherDress。纯演出。 */
  const [weatherDress, setWeatherDress] = useState<CardId | null>(null);
  /* R2-1（团队第 2 轮）：手机市场站的卡扇不再塞进右竖栏（栏内滚动
     把卡推到屏外，孩子看不到卡）——Game 在棋盘区上方常驻一层浮层
     挂载点，MarketPanel 用 portal 把卡扇送进去，像桌面一样浮在
     压暗棋盘上；右竖栏只留弹窗头 + 状态 + 操作按钮。挂载点元素
     经 state 回填（ref 首帧为 null 时卡扇先留在栏内，回填后迁移）。
     R2 验收修复：主操作（投放区/Done）也随卡扇进浮层——竖栏 402
     高里头+状态+三行按钮同屏放不下，Buy/Done 曾被推出帧外。 */
  const [marketHandEl, setMarketHandEl] = useState<HTMLDivElement | null>(null);
  /* R6：类别记号首访说明条（MarketPanel 首访回调喂进来，Toast 只播一次） */
  const [iconsNotice, setIconsNotice] = useState<{ id: string; text: string } | null>(null);
  /* R2 验收修复（ww 第 2 轮截图验收）：手机天气时刻同市场卡扇的病——
     结果卡塞在右竖栏里、棋盘不压暗、站名浮签被栏内滚动截出屏。
     同一味药：棋盘区上方再常驻一层天气浮层挂载点，EventPanel 用
     portal 把 .weather-moment（spin + card 两相位）送进去浮在压暗
     棋盘上；站名浮签留在竖栏弹窗头里（浮层不进栏、栏不再滚动，
     浮签自然整颗入镜）。 */
  const [weatherFloatEl, setWeatherFloatEl] = useState<HTMLDivElement | null>(null);
  const openSpot = (id: PlayerId) => setSpot({ id, manual: true });
  const closeSpot = () => setSpot(null);
  /* R1-E3 快进入口：点「正在行动的 bot」的角落小卡 = 先给它的回合
     快进（驱动层清零剩余延迟），同时照旧弹全屏卡看详情 */
  const openBotSpot = (id: PlayerId) => {
    if (board.activePlayerId === id) fastForwardBotTurn(id);
    openSpot(id);
  };
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
  // 提议浮签在场时它是当前要做的事：把浮签所在的 .phone-turn 块
  // 顶对齐到竖栏顶（浮签随之落在语言开关下方、整卡可见）。用
  // block:'start' 对齐块顶而不是浮签底——浮签下方内容（气泡/日志）
  // 增高不会把对齐点带偏（block:'end' 实测会被增高冲掉 68px，
  // 浮签首行被顶出屏外——R2 手机实测）。三个滚动写入点共用。
  const scrollRailToPill = (rail: HTMLElement): boolean => {
    const pill = rail.querySelector('.board-await');
    if (!pill) return false;
    const anchor = rail.querySelector('.phone-turn') ?? pill;
    anchor.scrollIntoView({ block: 'start' });
    return true;
  };
  const pinRail = () => {
    const rail = railRef.current;
    if (rail && stickBottom.current) {
      if (scrollRailToPill(rail)) return;
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
    // 有提议浮签时滚到浮签（ww 定稿的第一回应面：文案+两件菜图+
    // Yes/No）；没有浮签时滚到气泡；否则钉到栏底露出主按钮
    if (!scrollRailToPill(rail)) {
      const bubble = rail.querySelector('.speech-bubble');
      if (bubble) bubble.scrollIntoView({ block: 'end' });
      else rail.scrollTop = rail.scrollHeight;
    }
    lastScrollHeight.current = rail.scrollHeight;
  }, [railKey]);
  // 弹窗可能与决策不同步挂载：任何重渲染后仍吸底就保持钉底
  useEffect(pinRail);
  // 非渲染驱动的高度变化（字体加载重排、子节点增删）由观察器兜底
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !phoneLand) return;
    const recoverPin = () => {
      // 提议浮签在场：高度变化后仍把浮签留在视野里（与 pinRail 同
      // 口径），不许钉底把它顶出屏外。
      if (scrollRailToPill(rail)) {
        lastScrollHeight.current = rail.scrollHeight;
        return;
      }
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
  const lastLog = state.log[state.log.length - 1];
  // R10C：人类玩家的事件卡还盖着时，最后一条日志就是剧透——
  // toast 与 board-log 一律跳过它（引擎 log 本身不动）
  const eventVeiled =
    humanPending && pd.kind === 'eventOption' && !eventRevealed;
  const shownLog = eventVeiled
    ? (state.log[state.log.length - 2] ?? null)
    : lastLog;
  const sub = state.turn?.sub;

  /* R10E（§2 天气布景）：新一次天气时刻开始先清布景——
     真人等孩子点掉大天气卡才换（EventPanel.onWeatherDone 回调）；
     bot 没人点：R1-E3 简版——3D 转盘直落，DOM 侧留一拍
     （botWeatherSettleMs 400ms）就自动换，不再按真人整圈的 1900ms 等。 */
  const weatherNonce = `${state.stationIndex}:${state.turn?.orderIndex ?? 0}:${
    sub?.kind === 'event' ? sub.weatherId : '-'
  }`;
  useEffect(() => {
    if (sub?.kind !== 'event') return undefined;
    setWeatherDress(null);
    const actor = pendingPid
      ? state.players.find((p) => p.id === pendingPid)
      : null;
    if (actor && !actor.isHuman) {
      const t = window.setTimeout(() => {
        if (sub.kind === 'event') setWeatherDress(sub.weatherId);
      }, botWeatherSettleMs());
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherNonce]);

  /* R10E（§3 高光时刻）+ R1-E3：轮到 bot 行动时角落小卡自动亮约 1s
     （auto 态只点亮 BotCard/手机头像片，不开全屏帘、不挡操作）；
     站点弹窗开着不抢戏，孩子手动点开的（manual 全屏卡）不被自动
     覆盖、也不自动收。?fast=1（flags.fast）整条跳过——零延迟模式下
     bot 连环行动，自动高光没有意义。 */
  useEffect(() => {
    if (state.flags.fast) return undefined;
    const id = board.activePlayerId;
    if (!id) return undefined;
    const p = state.players.find((x) => x.id === id);
    if (!p || p.isHuman) return undefined;
    if (humanPending && pd.kind !== 'swapResponse') return undefined;
    setSpot((cur) => (cur?.manual ? cur : { id, manual: false }));
    const t = window.setTimeout(
      () =>
        setSpot((cur) => (cur && !cur.manual && cur.id === id ? null : cur)),
      1000,
    );
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.activePlayerId, humanPending, pd.kind, state.flags.fast]);

  /* R10E：高光帘吃 Esc（与点帘/点卡同义） */
  useEffect(() => {
    if (!spot) return undefined;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSpot();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [spot]);

  /* —— R10D（UI #8）图形化进度簇 ——
     3 枚圈点（过完=实心，当前=描边圈）+ 8 格站点条（走完=实心，
     脚下这枚带「我在这」环）。全部读既有 state，无新数据。 */
  const nextId = nextActorId(state);
  const progressCluster = (
    <div
      className="prog"
      role="img"
      aria-label={fmt(strings.hud.progressLabel, {
        lap: state.lap,
        n: state.stationIndex + 1,
      })}
    >
      <span className="lap-dots" aria-hidden="true">
        {Array.from({ length: gameConfig.laps }, (_, i) => i + 1).map((l) => (
          <i
            key={l}
            className={
              'lap-dot' +
              (l < state.lap ? ' lap-dot--done' : l === state.lap ? ' lap-dot--now' : '')
            }
          />
        ))}
      </span>
      <span className="stop-pips" aria-hidden="true">
        {gameConfig.stations.map((s, i) => (
          <i
            key={s.id}
            className={
              'stop-pip' +
              (i < state.stationIndex
                ? ' stop-pip--done'
                : i === state.stationIndex
                  ? ' stop-pip--here'
                  : '')
            }
          />
        ))}
      </span>
    </div>
  );

  /* R10D（UI #8 / play #4）：回合条换成「下一位」高亮的小头像片——
     与选中卡同语言的上抬+描边，不识字孩子也认得出该谁了。
     性格小徽已撤：性格只活在详情层（点头像的 ProfileCard 高光卡、
     伙伴站详情），常驻面不再摆图标+缩写。 */
  const orderChips = (state.turn?.order ?? []).map((id) => {
    const p = state.players.find((x) => x.id === id);
    if (!p) return null;
    const gain = lapGainOf(state, p.id);
    const isNext = nextId === id;
    return (
      <span
        key={id}
        className={
          'order-chip' + (isNext ? ' order-chip--next' : '')
        }
        title={isNext ? strings.hud.nextUp : undefined}
      >
        <span className="order-chip-ava" aria-hidden="true">
          {avatarIcon(p)}
        </span>
        {/* R10E（§4）：顺序片里币数画成金币点（迷你档）；
            R1-E4：金币点旁补可见数字，金币只作辅助（读屏口径不变）
            R2-5/R2-9：关掉金币点溢出尾徽（曾排出名单面板），「+n」只
            表示这一圈拿到的钱——与角落卡同源 lapGainOf、同值 */}
        <span className="order-chip-mid">
          <span className="order-chip-name">{playerDisplayName(p)}</span>
          <span className="order-chip-coins">
            <CoinDots n={p.coins} cap={5} className="coin-dots--xs" hideExtra />
            <span className="order-chip-num" aria-hidden="true">{p.coins}</span>
            {gain > 0 && (
              <span className="order-chip-gain" aria-hidden="true">
                +{gain}
              </span>
            )}
          </span>
        </span>
        {isNext && <span className="sr-only">{strings.hud.nextUp}</span>}
      </span>
    );
  });

  // 发给真人的提议（伙伴站换菜/一起买）：锚在发起者的小卡下
  const proposal =
    pd.kind === 'swapResponse'
      ? state.proposals.find((p) => p.id === pd.proposalId)
      : undefined;
  const proposalFrom = proposal
    ? state.players.find((p) => p.id === proposal.from)
    : undefined;

  /* 等真人回应提议（换菜/一起买）时，驱动已停摆但 currentActorId
     仍是发起的 bot——发起者的 BotCard 不再亮「正在想…」（下方
     thinking 传 !awaitKind）。回应提示按团队第 2 轮 ww 定稿走
     ProposalPill 浮签卡（写清提议内容 + 两件菜图 + Yes/No 药丸按钮，
     见 boardOverlay）；角落气泡保留但不是唯一入口。团队第 2 轮更正：
     不设任何计时提醒（R1 的 10s 气泡轻跳已撤除），绝不替孩子回应。 */
  const awaitKind = awaitingHumanKind(pd, state.humanId);
  const awaitProposal =
    awaitKind && 'proposalId' in pd
      ? state.proposals.find((p) => p.id === pd.proposalId)
      : undefined;
  const awaitFrom = awaitProposal
    ? state.players.find((p) => p.id === awaitProposal.from)
    : proposalFrom;

  const renderBotSlot = (b: (typeof bots)[number]) => {
    // R10C（education #3）：bot 心里话气泡——最新一条日志归它时，
    // 用 spend.kind + 性格映成一句短理由（复用日志时序，不加事件）
    // R10D（education #5）：第 2 圈起气泡只留「先等等」（botThink 内判）
    const think = botThinkLine(b, lastLog, state.lap);
    const trait = botTrait(b);
    return (
      <div className="bot-slot" key={b.id}>
        <BotCard
          player={b}
          thinking={board.activePlayerId === b.id && !awaitKind}
          expanded={spot?.id === b.id}
          autoSpot={spot?.id === b.id && !spot.manual}
          lapGain={lapGainOf(state, b.id)}
          onOpen={openBotSpot}
        />
        {think && (
          <p
            className={
              'think-bubble' + (trait ? ` think-bubble--${trait.key}` : '')
            }
            key={lastLog.id}
          >
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

  let panel = <AutoPanel state={state} send={send} />;
  switch (pd.kind) {
    case 'drawRecipe':
      panel = <DrawTaskPanel state={state} send={send} />;
      break;
    case 'marketTurn':
      panel = (
        <MarketPanel
          state={state}
          send={send}
          handFloatEl={phoneLand ? marketHandEl : null}
          onFirstMarketOpen={() =>
            setIconsNotice({ id: 'icons-intro', text: strings.panel.iconsIntro })
          }
        />
      );
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
          onWeatherDone={setWeatherDress}
          momentFloatEl={phoneLand ? weatherFloatEl : null}
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

  // 「进入这一站 + 最近一条日志」——桌面/平板放进棋盘 overlay；
  // 手机横屏放进右竖栏顶部。
  // R2-12（团队第 2 轮）：同一句话一个画面只说一次——轮到谁只标在
  // 该玩家的角落卡（高光/thinking 态），这里不再有 Your turn /
  // Zip's turn 轮次文字；事件只走浮签/提示条，日志行保留一行且与
  // Toast 同口径本地化（R2 一致性）。「Go to this stop」保留为底部
  // 居中橙色浮动药丸（.board-enter，见 board.css）。
  const boardOverlay = introPhase ? (
    <>
      <p className="board-town">{strings.game.townAlt}</p>
      {pendingPid === state.humanId && (
        <Button
          variant="primary"
          className="board-enter"
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          onClick={() => send({ type: 'ACK' })}
        >
          {/* R1-E7：主文案与 kbd 提示拆成两个同级盒——旧结构把提示
              内联在文案 span 里，手机栏隐藏提示后文案的折行盒仍按
              「文案+提示」一起算，曾量到文字 76 > 按钮 72 的溢出；
              拆开后手机栏内只剩主文案一个盒（提示在 .phone-turn 里
              直接 display:none，见 phone.css），折行只由主文案决定 */}
          <span className="board-enter-label">{strings.game.enterStation}</span>
          <span className="btn-kbd-hint" aria-hidden="true">
            {strings.game.enterStationKbd}
          </span>
        </Button>
      )}
    </>
  ) : (
    <>
      <p className="board-town">{strings.game.townAlt}</p>
      {awaitKind && awaitFrom && awaitProposal && (
        /* 等真人回应提议的浮签卡（团队第 2 轮 ww 定稿）：写清提议
           内容 + 两件菜图 + Yes/No 药丸按钮，挂在棋盘中央（手机横屏
           时随 boardOverlay 进右竖栏）；与角落气泡同一条回应命令 */
        <ProposalPill
          from={awaitFrom}
          proposal={awaitProposal}
          onRespond={(accept) =>
            send(
              awaitProposal.kind === 'swap'
                ? { type: 'RESPOND_SWAP', proposalId: awaitProposal.id, accept }
                : { type: 'RESPOND_INVITE', proposalId: awaitProposal.id, accept },
            )
          }
        />
      )}
      {shownLog && (
        <p className="board-log" aria-live="polite">
          {/* 与 Toast 同口径：引擎烘焙的英文槽位名按当前语言重渲染 */}
          {localizeLogText(shownLog.text)}
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

  // R10D（education #6）：弹窗头部副行——学习目标小片 + 迷你菜谱进度条
  const recipeStrip: RecipeStripItem[] | undefined = human.recipeId
    ? getRecipe(human.recipeId)?.ingredientIds.map((id) => ({
        id,
        icon: getIngredient(id)?.icon ?? '❔',
        got: human.collected.includes(id),
      }))
    : undefined;

  /* R2-6（团队第 2 轮）：市场站浮签定稿——站名用定稿短名
     （② The Market / ② 菜市场），右边挂金币角标 ×N（N = 还能买的
     张数，取 market 子状态既有 buysLeft，不新造计数）；「Practice:
     notice temptations」练习标签从顶部撤掉，挪进「How to play」
     （HelpCard 已加当前站练习行）。其他站浮签维持原口径不动。 */
  const isMarket = station.id === 'market';
  const marketBuysLeft = sub?.kind === 'market' ? sub.buysLeft : null;

  // R10D（interaction #8）：PopupOutlet 统一给所有站点弹窗加进出场；
  // 弹窗关掉时保留最后一帧 ~160ms 播淡出（一处实现，三处受益）
  const popupEl = (
    <PopupOutlet show={showPopup}>
      <StationPopup
        title={`${CIRCLED[state.stationIndex] ?? state.stationIndex + 1} ${isMarket ? strings.hud.marketTitle : stationName(station.id)}`}
        testid={`panel-${station.id}`}
        goal={isMarket ? undefined : stationGoal(station.id)}
        recipe={recipeStrip}
        badge={
          isMarket && marketBuysLeft !== null ? (
            <span
              className="popup-coin-badge"
              role="img"
              aria-label={fmt(strings.panel.buysLeft, { n: marketBuysLeft })}
            >
              <i className="popup-coin-badge-dot" aria-hidden="true" />
              <span aria-hidden="true">×{marketBuysLeft}</span>
            </span>
          ) : undefined
        }
        aside={
          phoneLand && station.id === 'store' ? strings.panel.storeAll : undefined
        }
      >
        {panel}
      </StationPopup>
    </PopupOutlet>
  );

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

  /* R10E（§3）：高光帘里的角色卡数据（纯派生，不在就整个帘不画） */
  const spotPlayer = spot
    ? state.players.find((p) => p.id === spot.id)
    : null;
  const dress = weatherDressFor(weatherDress);

  return (
    <div
      className={
        'game-screen' +
        (phoneLand ? ' game-screen--phone-land' : '') +
        (dress ? ` weather--${dress}` : '')
      }
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
          <BoardMount {...board} weatherDress={weatherDress} compact={phoneLand}>
            {phoneLand ? null : boardOverlay}
          </BoardMount>
        </div>

        {!phoneLand && (
          <aside className="game-right">
            {bots.slice(2).map(renderBotSlot)}
            {/* R10E（§4 卡片节食）：圈数文字/「顺序：」标签撤掉——
                图形簇（3 圈点 + 8 站点格 + 小头像片）自己就讲得清 */}
            <div className="lap-card">
              {progressCluster}
              {orderChips.length > 0 && (
                <span className="order-strip">{orderChips}</span>
              )}
            </div>
          </aside>
        )}

        {!phoneLand && (
          <footer className="game-bottom">
            {/* R10E（§3/§4）：真人头像=「我的卡」ID 卡入口（点开高光卡） */}
            <button
              type="button"
              className="me-avatar"
              data-testid="me-card"
              aria-label={strings.hud.meCard}
              aria-expanded={spot?.id === human.id}
              onClick={() => openSpot(human.id)}
            >
              <span className="me-avatar-icon">{playerIcon(human.characterId)}</span>
              <span className="me-name">{playerDisplayName(human)}</span>
            </button>
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
            {/* R10E（§4）：钱包=一小摞真金币 + 大数字（币堆即钱包入口） */}
            <button
              type="button"
              className="me-coins coin-pile"
              data-testid="btn-wallet"
              onClick={onOpenWallet}
              aria-label={fmt(strings.hud.walletWithCoins, {
                n: human.coins,
              })}
            >
              <CoinDots n={human.coins} className="coin-pile-dots" hideExtra />
              <span className="coin-pile-num">
                <CoinCounter value={human.coins} label={myCoinsLabel} />
              </span>
            </button>
            {/* R10E（§4）：先等等=迷你卡夹（两片卡影 + 角徽） */}
            <div
              className="clip-chip clip-chip--hold"
              aria-label={fmt(strings.hud.holdClipAria, {
                item: holdClipInfo ? cardName(human.holdClip!) : strings.hud.empty,
              })}
            >
              <span className="clip-stack" aria-hidden="true">
                <i />
                <i />
                <i className="clip-badge">{human.holdClip ? '1' : '–'}</i>
              </span>
              <span className="clip-chip-sub">{strings.hud.holdClip}</span>
            </div>
            {/* R10E（§4）：待付=卡夹 + 一枚 IOU 代币 */}
            <div
              className="clip-chip clip-chip--debt"
              aria-label={fmt(strings.hud.busDebtAria, { n: human.busDebt })}
            >
              <span className="clip-stack" aria-hidden="true">
                <i />
                <i />
                <i className="iou-token">
                  {human.busDebt > 0 ? human.busDebt : '–'}
                </i>
              </span>
              <span className="clip-chip-sub">{strings.hud.busDebt}</span>
            </div>
            {/* R10E（§4）：求助牌=一张小求助卡 */}
            <button
              type="button"
              className="clip-chip clip-chip--help"
              data-testid="btn-help"
              onClick={onOpenHelp}
              aria-label={strings.hud.help}
            >
              <span className="help-card-btn" aria-hidden="true">
                ?
              </span>
              <span className="clip-chip-sub">{strings.hud.help}</span>
            </button>
          </footer>
        )}
      </div>

      <Toast
        entries={eventVeiled ? state.log.slice(0, -1) : state.log}
        humanId={state.humanId}
        notice={iconsNotice}
      />

      {phoneLand ? (
        <>
          {/* R2-1：市场卡扇浮层挂载点（棋盘区上方、压暗层 + 居中浮卡；
              空时 CSS :empty 隐藏，市场弹窗关掉卡扇随面板卸载自动清空） */}
          <div className="phone-market-float" ref={setMarketHandEl} />
          {/* R2 验收修复：天气时刻浮层挂载点（与市场浮层同模式，
              空时 :empty 隐藏；两层不会同时有内容——不同站点） */}
          <div className="phone-weather-float" ref={setWeatherFloatEl} />
          {/* 左上：一圈小头像排（第几圈 + 3 个电脑人，点头像展开详情） */}
          <div className="phone-bots">
            <span className="phone-lap">
              {fmt(strings.hud.lapCompact, { lap: state.lap, laps: gameConfig.laps })}
            </span>
            {/* R10D（UI #8）：圈点 + 站点格进度簇，贴在小头像排前 */}
            {progressCluster}
            {bots.map((b) => {
              const trait = botTrait(b);
              const isNext = nextId === b.id;
              return (
                <span className="phone-bot-wrap" key={b.id}>
                  {/* R10C：心里话气泡也贴到手机小头像上；R10D 起按圈数撤
                      （botThink 内部判 lap），气泡描边按人配色（性格
                      小徽已撤——全词性格只在点头像的高光卡里） */}
                  {(() => {
                    const t = botThinkLine(b, lastLog, state.lap);
                    return t ? (
                      <span
                        className={
                          'think-bubble think-bubble--phone' +
                          (trait ? ` think-bubble--${trait.key}` : '')
                        }
                        key={lastLog.id}
                      >
                        {t}
                      </span>
                    ) : null;
                  })()}
                  <button
                    type="button"
                    className={
                      'phone-bot' +
                      (board.activePlayerId === b.id ? ' phone-bot--on' : '') +
                      (isNext ? ' phone-bot--next' : '') +
                      (spot?.id === b.id && !spot.manual ? ' phone-bot--spot' : '')
                    }
                    data-bot={b.characterId ?? undefined}
                    aria-expanded={spot?.id === b.id}
                    aria-label={
                      fmt(strings.hud.botChip, {
                        name: playerDisplayName(b),
                        n: b.coins,
                      }) + (isNext ? ` · ${strings.hud.nextUp}` : '')
                    }
                    onClick={() => openBotSpot(b.id)}
                  >
                    <span className="phone-bot-avatar" aria-hidden="true">
                      {botIcon(b)}
                    </span>
                    {/* R10E（§4）：币数画成迷你金币点；
                        R1-E4：旁边补可见数字，金币只作辅助（读屏走 aria-label）
                        R2-9：关掉溢出尾徽——「+」只表示这一圈拿到的钱 */}
                    <span className="phone-bot-coins-row">
                      <CoinDots n={b.coins} cap={5} className="coin-dots--xs" hideExtra />
                      <span className="phone-bot-num" aria-hidden="true">{b.coins}</span>
                    </span>
                  </button>
                </span>
              );
            })}
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

      {/* R10E（§3 高光时刻）：ProfileCard 全屏卡——点帘/点卡/Esc 都收；
          R1-E3：全屏卡只给 manual（孩子点徽章/小头像亲手开的）；
          bot 的 auto 高光改走角落小卡 --spot 态（见上方 effect），
          不再用全屏帘挡住下方操作 */}
      {spotPlayer && spot?.manual && (
        <div className="spotlight-veil" onClick={closeSpot}>
          <ProfileCard
            player={spotPlayer}
            info={spotlightInfo(
              spotPlayer,
              board.activePlayerId === spotPlayer.id,
            )}
            contact={
              spotPlayer.isHuman ? strings.hud.spotlightBasket : undefined
            }
            onContact={
              spotPlayer.isHuman
                ? () => {
                    closeSpot();
                    onOpenWallet();
                  }
                : undefined
            }
            onDismiss={closeSpot}
          />
        </div>
      )}
    </div>
  );
}
