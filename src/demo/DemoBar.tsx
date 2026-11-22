/**
 * DemoBar.tsx —— 演示控制条（REQUIREMENTS §8，给老师现场演示用）。
 * ?demo=1 或按 D 开合；显示在游戏画面外侧顶部，不遮挡游戏主体。
 * 全部原生 <button>、键盘可达（Tab 聚焦 + Enter 激活）：
 *   - 跳到任意站：第 1–3 圈 × 第 1–8 站 → DEMO_JUMP（引擎自动补菜谱等前置）
 *   - 重新开始 → RESTART；电脑无延迟开关 → SET_FLAG fast
 *   - 逐 bot 切性格 → DEMO_SET_PERSONALITY（稳妥/冲动/跟风）
 *   - 「演示：花光零钱」：合法命令序列（反复跳菜市场买最贵的卡→跳公交站），
 *     把真人零钱花到低于车费，用来演示公交站「待付夹」。
 */
import { useState } from 'react';
import { gameConfig } from '../config/gameConfig';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { chooseBotCommand } from '../game/bots';
import { fmt, marketPriceOf } from '../game/stations/shared';
import { botPersonalityLabel, cardName, stationName } from '../i18n/cardText';
import type { BotPersonality, GameState } from '../game/types';
import type { SendCommand } from '../ui/useGame';
import { GlideTrack } from '../components/bits/GlideTrack';

/* R6：label 在渲染时按当前语言解析（模块级捕获会冻住英文） */
const PERSONALITIES: { id: BotPersonality; botId: string }[] = cards.bots.map((b) => ({
  id: b.personality,
  botId: b.id,
}));

/** 「花光零钱」：只发合法命令，把真人币数压到第 1 圈车费以下，再跳公交站 */
function spendAllCoins(send: SendCommand) {
  const fee = gameConfig.busFeeByLap[0] ?? 0;
  const MARKET = 1; // stationIndex：②菜市场
  const BUS = 3; // stationIndex：④公交站
  const jump = (idx: number) =>
    send({ type: 'DEMO_JUMP', lap: 1, stationIndex: idx }).state;
  const coins = (s: GameState) => s.players.find((p) => p.isHuman)!.coins;

  let s = jump(MARKET);
  for (let i = 0; i < 3000 && coins(s) >= fee; i++) {
    if (s.phase !== 'station') {
      s = jump(MARKET);
      continue;
    }
    if (s.turn?.turnPhase === 'intro') {
      s = send({ type: 'ACK' }).state;
      continue;
    }
    const pd = s.pendingDecision;
    const pid = 'playerId' in pd ? pd.playerId : null;
    const me = s.players.find((p) => p.isHuman)!;
    if (pid !== me.id) {
      // bot 回合：同步替它走一步合法命令；没有待决输入就跳回菜市场
      s = pid ? send(chooseBotCommand(s, pid)).state : jump(MARKET);
      continue;
    }
    if (pd.kind === 'marketTurn' && s.turn?.sub.kind === 'market') {
      const sub = s.turn.sub;
      const pick = [...new Set(s.market.stall.filter((x): x is string => x !== null))]
        .filter((id) => !sub.boughtIds.includes(id)) // 同一张卡本站已买过就不再挑
        .map((id) => ({ id, price: marketPriceOf(id) ?? Number.POSITIVE_INFINITY }))
        .filter((c) => c.price <= me.coins)
        .sort((a, b) => b.price - a.price)[0];
      s =
        sub.buysLeft > 0 && pick
          ? send({ type: 'STALL_BUY', cardId: pick.id }).state
          : jump(MARKET); // 这回合买不了了 → 重开菜市场再买下轮
      continue;
    }
    if (pd.kind === 'ack') {
      s = send({ type: 'ACK' }).state;
      continue;
    }
    if (pd.kind === 'drawRecipe') {
      s = send({ type: 'DRAW_RECIPE' }).state;
      continue;
    }
    s = jump(MARKET); // 其它真人决定（邀请/换菜/家长站…）一律跳回菜市场
  }
  jump(BUS); // 落到公交站：零钱 < 车费 → 真人可点「先记进待付夹」
}

export function DemoBar({
  state,
  send,
  onClose,
}: {
  state: GameState;
  send: SendCommand;
  onClose: () => void;
}) {
  const [lap, setLap] = useState(state.lap);
  const [station, setStation] = useState(state.stationIndex + 1); // 展示用 1..8
  const bots = state.players.filter((p) => !p.isHuman);

  return (
    <div className="demo-bar" data-testid="demo-bar">
      <span className="demo-title">{strings.demo.title}</span>

      <div className="demo-group" role="group" aria-label={strings.demo.jumpTitle}>
        <span className="demo-label">{strings.demo.jumpTitle}</span>
        {/* WS1 A15：圈数/站点/动作各一条 Glide Select 轨道——选中项底下
            伏一条滑动指示丸，悬停/按下/聚焦滑走，离开滑回（go/warn 丸
            染变体色）。chip 的类名/testid/命令一字不动 */}
        <GlideTrack>
          {Array.from({ length: gameConfig.laps }, (_, i) => i + 1).map((l) => (
            <button
              key={l}
              type="button"
              className={'demo-chip' + (lap === l ? ' demo-chip--on' : '')}
              aria-pressed={lap === l}
              data-testid={`demo-lap-${l}`}
              onClick={() => setLap(l)}
            >
              {fmt(strings.demo.lapShort, { n: l })}
            </button>
          ))}
        </GlideTrack>
        <GlideTrack>
          {gameConfig.stations.map((st, i) => (
            <button
              key={st.id}
              type="button"
              className={'demo-chip' + (station === i + 1 ? ' demo-chip--on' : '')}
              aria-pressed={station === i + 1}
              aria-label={`${i + 1} ${stationName(st.id)}`}
              data-testid={`demo-station-${i + 1}`}
              onClick={() => setStation(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </GlideTrack>
        <GlideTrack>
          <button
            type="button"
            className="demo-chip demo-chip--go"
            data-testid="demo-jump"
            onClick={() => send({ type: 'DEMO_JUMP', lap, stationIndex: station - 1 })}
          >
            {strings.demo.jump}
          </button>
        </GlideTrack>
      </div>

      <div className="demo-group" role="group" aria-label={strings.demo.personalityTitle}>
        <span className="demo-label">{strings.demo.personalityTitle}</span>
        {bots.map((b) => (
          <span key={b.id} className="demo-bot">
            <span className="demo-label">{cardName(b.characterId ?? '')}</span>
            <GlideTrack>
              {PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={'demo-chip' + (b.personality === p.id ? ' demo-chip--on' : '')}
                  aria-pressed={b.personality === p.id}
                  data-testid={`demo-per-${b.id}-${p.id}`}
                  onClick={() =>
                    send({ type: 'DEMO_SET_PERSONALITY', playerId: b.id, personality: p.id })
                  }
                >
                  {botPersonalityLabel(cards.bots.find((x) => x.id === p.botId)!)}
                </button>
              ))}
            </GlideTrack>
          </span>
        ))}
      </div>

      <div className="demo-group">
        <GlideTrack>
          <button
            type="button"
            className="demo-chip"
            data-testid="demo-fast"
            aria-pressed={state.flags.fast}
            onClick={() => send({ type: 'SET_FLAG', flag: 'fast', value: !state.flags.fast })}
          >
            {strings.demo.fast}: {state.flags.fast ? strings.demo.on : strings.demo.off}
          </button>
          <button
            type="button"
            className="demo-chip"
            data-testid="demo-restart"
            onClick={() => send({ type: 'RESTART' })}
          >
            {strings.demo.restart}
          </button>
          <button
            type="button"
            className="demo-chip demo-chip--warn"
            data-testid="demo-spend-all"
            title={strings.demo.spendAllHint}
            aria-label={`${strings.demo.spendAll}: ${strings.demo.spendAllHint}`}
            onClick={() => spendAllCoins(send)}
          >
            {strings.demo.spendAll}
          </button>
          <button
            type="button"
            className="demo-chip"
            data-testid="demo-close"
            onClick={onClose}
          >
            {strings.demo.close}
          </button>
        </GlideTrack>
      </div>
    </div>
  );
}
