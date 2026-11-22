/**
 * BotCard.tsx —— R10 Slice E（§4 HUD 节食）：电脑玩家从「信息小卡」
 * 收成一枚徽章——头像 + 名签 + 物理金币点 + 买到的迷你卡砖缩略图；
 * 币数/买了什么不再写字。徽章本身是按钮：点一下弹出 ProfileCard
 * 高光卡（Spotlight——性格全词只活在那个详情层里，常驻面上不再
 * 摆图标+缩写小徽）。轮到它时仍显示「正在想…」高亮。
 */
import { useEffect, useRef, useState } from 'react';
import { cards, getIngredient } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { playerDisplayName } from '../i18n/cardText';
import type { CardId, Player, PlayerId } from '../game/types';
import { CardIcon } from './CardIcon';
import { CoinDots } from './CoinDots';
import { CountUp } from './bits/CountUp';
import { cardArtFor } from './cards/cardArt';
import { StatusMark } from './StatusMark';
import { SpotlightLayer } from './reactbits/SpotlightCard';

function cardIcon(id: CardId): string {
  return (
    getIngredient(id)?.icon ??
    cards.temptations.find((t) => t.id === id)?.icon ??
    '❔'
  );
}

function MiniThumb({ id, flash }: { id: CardId; flash?: boolean }) {
  const art = cardArtFor(id);
  return (
    <span
      className={'bot-thumb' + (flash ? ' bot-thumb--just-played' : '')}
      data-thumb={id}
      aria-hidden="true"
    >
      {art ? <img src={art} alt="" draggable={false} /> : <CardIcon icon={cardIcon(id)} />}
    </span>
  );
}

export function BotCard({
  player,
  thinking,
  expanded,
  autoSpot,
  lapGain,
  actedStamp,
  onOpen,
}: {
  player: Player;
  thinking: boolean;
  /** 高光卡是否正开着（aria-expanded） */
  expanded?: boolean;
  /** R1-E3：轮到它时的自动角落高光（~1s，不开全屏帘） */
  autoSpot?: boolean;
  /** R2-9：这一圈拿到的钱（lapGainOf 派生，与右侧名单顺序片同源同值）；
   * >0 才显示「+n」，这是 HUD 里唯一的「+数字」语义 */
  lapGain?: number;
  /** 手感审计 #1：它最近一条带 spend 的日志 id——动作落地时整卡迸
   * 一圈薄荷闪、新买到的那张迷你砖同闪，让孩子不用读 toast 也能
   * 看见「它刚买了/付了什么」。null/不传 = 无痕迹 */
  actedStamp?: number | null;
  /** 点徽章 → ProfileCard 高光（桌面 spotlight / 手机同帘） */
  onOpen?: (id: PlayerId) => void;
}) {
  const bot = cards.bots.find((b) => b.id === player.characterId);
  const bought = [...player.collected, ...player.extras, ...player.temptations];
  // B8（React Bits "Spotlight Card"）：按压柔光只加在卡壳层——
  // lap-gain 徽标与「正在想…」指示器的标记/类名/行为一律不动
  const cardRef = useRef<HTMLButtonElement>(null);

  /* —— 手感审计 #1：动作落地痕迹 ——
     prevBoughtRef 记上一次提交的买到清单，actedStamp 变化时做多重集
     差分：多出的最后一张就是刚买到的卡（车费/事件花费没有新卡，
     cardId 为 null，只闪整卡）。痕迹保留 900ms（与 card-played-flash
     同长、与角落高光约 1s 同拍），定时器存 ref，重渲染不打断。 */
  const prevBoughtRef = useRef<CardId[]>([]);
  const lastStampRef = useRef<number | null>(null);
  const traceTimerRef = useRef<number | null>(null);
  const [trace, setTrace] = useState<{ stamp: number; cardId: CardId | null } | null>(
    null,
  );
  useEffect(() => {
    const prev = prevBoughtRef.current;
    prevBoughtRef.current = bought;
    if (actedStamp == null || actedStamp === lastStampRef.current) return;
    lastStampRef.current = actedStamp;
    const rest = [...prev];
    let cardId: CardId | null = null;
    for (const id of bought) {
      const k = rest.indexOf(id);
      if (k >= 0) rest.splice(k, 1);
      else cardId = id;
    }
    setTrace({ stamp: actedStamp, cardId });
    if (traceTimerRef.current !== null) window.clearTimeout(traceTimerRef.current);
    traceTimerRef.current = window.setTimeout(
      () => setTrace((cur) => (cur?.stamp === actedStamp ? null : cur)),
      900,
    );
  });
  useEffect(
    () => () => {
      if (traceTimerRef.current !== null) window.clearTimeout(traceTimerRef.current);
    },
    [],
  );
  const traceIdx =
    trace && trace.cardId ? bought.lastIndexOf(trace.cardId) : -1;

  /* WS4 D10：「正在想…」改走收编 StatusMark——环底常驻、轮到它转
     进度弧，想完弧收成对勾亮一拍（800ms）再收。只动 .bot-card-thinking
     这一块；think-pop 弹跳归 WS5 不动。 */
  const [doneBeat, setDoneBeat] = useState(false);
  const wasThinkingRef = useRef(thinking);
  useEffect(() => {
    const was = wasThinkingRef.current;
    wasThinkingRef.current = thinking;
    if (!was || thinking) return undefined;
    setDoneBeat(true);
    const t = window.setTimeout(() => setDoneBeat(false), 800);
    return () => window.clearTimeout(t);
  }, [thinking]);

  return (
    <button
      type="button"
      ref={cardRef}
      className={
        'bot-card' +
        (thinking ? ' bot-card--thinking' : '') +
        (autoSpot ? ' bot-card--spot' : '') +
        (trace ? ' bot-card--just-played' : '')
      }
      data-testid={`bot-${player.id}`}
      data-bot={player.characterId ?? undefined}
      aria-label={fmt(strings.hud.botChip, {
        name: playerDisplayName(player),
        n: player.coins,
      })}
      aria-expanded={expanded}
      onClick={onOpen ? () => onOpen(player.id) : undefined}
    >
      {/* B8：按压聚光（触屏 pointerdown 点亮、跟随、松手渐隐；
          键盘 focus-visible 在卡中心点亮；reduced-motion 直亮不滑） */}
      <SpotlightLayer host={cardRef} size={110} intensity={0.55} />
      <span className="bot-card-avatar" aria-hidden="true">
        {bot?.icon ?? '●'}
      </span>
      <span className="bot-card-body">
        <span className="bot-card-name">
          {playerDisplayName(player)}
          {(thinking || doneBeat) && (
            <span className="bot-card-thinking">
              <StatusMark status={thinking ? 'running' : 'done'} />
              {thinking && strings.game.thinking}
            </span>
          )}
        </span>
        {/* R1-E4：金币点只作辅助，旁边一直有可见数字（读屏仍走按钮 aria-label）
            R2-5：窄列里点排 + 数字曾整行溢出面板——CoinDots 关掉溢出
            尾徽（R2-9：+ 只表示这一圈拿到的钱）、整行可折行，全部留在卡内；
            R2-9：这一圈拿到的钱（与顺序片同源 lapGainOf） */}
        <span className="bot-card-coins">
          <CoinDots n={player.coins} cap={8} hideExtra />
          <span className="bot-coin-num" aria-hidden="true">{player.coins}</span>
          {lapGain !== undefined && lapGain > 0 && (
            <span className="bot-lap-gain" aria-hidden="true">
              {/* WS3 C7：得币角标数字走 vendored Count Up——gain 变化即滚动 */}
              +<CountUp to={lapGain} duration={0.5} />
            </span>
          )}
        </span>
        {bought.length > 0 && (
          <span className="bot-thumbs" aria-hidden="true">
            {bought.slice(0, 5).map((id, i) => (
              <MiniThumb key={`${id}-${i}`} id={id} flash={i === traceIdx} />
            ))}
            {bought.length > 5 && (
              <span className="bot-thumb bot-thumb--more">
                +{bought.length - 5}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}
