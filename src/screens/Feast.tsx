/**
 * Feast.tsx —— 一起开饭（G6）。
 * 一张浅色长桌上并排 4 张盘子卡：圆盘图 + 名字 + 菜名 + 结局标签
 * （完整的菜 / 简单的菜 / 下次补上，顺序固定为座位顺序，不排序、不比较）。
 * 按钮：① 我的钱（真人自己的流水，分组小计）→ 一起说决定。
 * （交互审 U8：桌旁不再放「再玩一局」——重开只在反思页终点与演示条。）
 * 竖屏 2×2 盘子网格、按钮纵向全宽（媒体查询）。
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { getRecipe } from '../data/cards';
import { coinWord, strings } from '../data/strings';
import { moneyLedger } from '../game/selectors';
import { fmt } from '../game/stations/shared';
import { cardName, playerDisplayName } from '../i18n/cardText';
import type { Command, GameState, PlateResult } from '../game/types';
import { Button } from '../components/Button';
import { CardIcon } from '../components/CardIcon';
import { cardArtFor, cardBgFor } from '../components/cards/cardArt';
import { CoinCounter } from '../components/cards/CoinCounter';
import { AnimatedList } from '../components/bits/AnimatedList';
import { CountUp } from '../components/bits/CountUp';
import { BlurText } from '../components/text/BlurText';
import { playSparkAt } from '../components/cards/PlaySpark';
import { AnimatedContent } from '../components/motion/AnimatedContent';

/* R6：不能放模块级 —— 语言切换时要按当前语言现取（模块级会冻住英文） */
function kindLabel(kind: PlateResult['kind']): string {
  return {
    full: strings.feast.plateFull,
    simple: strings.feast.plateSimple,
    shadow: strings.feast.plateShadow,
  }[kind];
}

function plateNote(plate: PlateResult): string {
  if (plate.kind === 'full') return strings.feast.noteFull;
  if (plate.kind === 'simple') return fmt(strings.feast.noteSimple, { n: plate.missing.length });
  return strings.feast.noteShadow;
}

export function Feast({ state, send }: { state: GameState; send: (c: Command) => unknown }) {
  const [showLedger, setShowLedger] = useState(false);
  const human = state.players.find((p) => p.isHuman)!;
  /* 开饭高光（手感审计 #3）：满盘逐张落定各迸一次 PlaySpark。旧版全场
     只在桌心迸一团——最多 4 张满盘共用一次火花，全局最高潮被摊薄。
     现按每张盘自己的落定时点触发（AnimatedContent 'pop' 错峰：
     60ms/张 + SPRING_POP），火花跟着盘子走；同屏并发由 PlaySpark
     自带 ≤3 闸门兜底。纯演出：不读新数据、不发命令。 */
  const plateRefs = useRef(new Map<string, HTMLDivElement>());
  const sparkedRef = useRef(new Set<string>());
  const sparkTimers = useRef<number[]>([]);
  useEffect(
    () => () => {
      sparkTimers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );
  useEffect(() => {
    if (showLedger) return;
    (state.plates ?? []).forEach((plate, i) => {
      if (plate.kind !== 'full' || sparkedRef.current.has(plate.playerId)) return;
      sparkedRef.current.add(plate.playerId);
      sparkTimers.current.push(
        window.setTimeout(
          () => playSparkAt(plateRefs.current.get(plate.playerId)),
          i * 60 + 260,
        ),
      );
    });
  }, [state.plates, showLedger]);

  if (showLedger) {
    const ledger = moneyLedger(state, human.id);
    return (
      <main className="intro-shell" data-testid="screen-feast">
        {/* WS3 C15：屏幕级标题——错峰 + Blur Text 焦点回落 */}
        <BlurText as="h1" className="intro-title intro-title--sm" text={strings.ledger.title} />
        <div className="ledger" data-testid="ledger">
          <p className="ledger-line ledger-line--start">
            {fmt(strings.ledger.start, { n: ledger.startCoins })}
          </p>
          <div className="ledger-scroll">
            {ledger.groups.map((g) => (
              <section key={g.kind} className="ledger-group">
                <p className="ledger-group-title">
                  {g.label}
                  <span className="ledger-group-total">
                    {/* WS3 C20：分组小计走 vendored Count Up 滚动（与
                        ledger-left 的 CoinCounter 同口径分句） */}
                    {strings.ledger.groupTotal.split('{n}')[0]}
                    <CountUp to={g.total} duration={0.6} />
                    {strings.ledger.groupTotal.split('{n}')[1]}
                  </span>
                </p>
                {/* WS3 C20：明细行弹入 = vendored Animated List（行弹簧
                    错峰入场；reduced-motion 静态直出） */}
                <AnimatedList
                  className="ledger-lines"
                  itemClassName="ledger-line"
                  animation="pop"
                  stagger={0.045}
                  items={g.lines.map((l) => ({
                    key: `${g.kind}-${l.id}`,
                    node: (
                      <>
                        {g.kind === 'gain' ? '+' : '−'}
                        {l.coins} {coinWord(l.coins)} ·{' '}
                        {l.lap !== undefined && (
                          <span className="ledger-line-lap">
                            {fmt(strings.ledger.lapTag, { n: l.lap })} ·{' '}
                          </span>
                        )}
                        {l.text}
                      </>
                    ),
                  }))}
                />
              </section>
            ))}
          </div>
          <p className="ledger-line ledger-line--left">
            {/* R10 Slice B：句中数字换成 CoinCounter 滚动位（§2.8 币总计） */}
            {strings.ledger.left.split('{n}')[0]}
            <CoinCounter
              value={ledger.coinsLeft}
              label={fmt(strings.ledger.left, { n: ledger.coinsLeft })}
              className="ledger-coins"
            />
            {strings.ledger.left.split('{n}')[1]}
          </p>
          {ledger.busDebt > 0 && (
            <p className="ledger-line screen-note">
              {fmt(strings.ledger.debtLeft, { n: ledger.busDebt })}
            </p>
          )}
        </div>
        <div className="feast-actions">
          <Button
            variant="primary"
            data-testid="action-primary"
            data-primary="true"
            data-key={1}
            onClick={() => send({ type: 'ACK' })}
          >
            {strings.feast.toReflection}
          </Button>
          <Button
            variant="secondary"
            data-testid="action-2"
            data-key={2}
            onClick={() => setShowLedger(false)}
          >
            {strings.feast.ledgerBack}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="intro-shell" data-testid="screen-feast">
      {/* WS3 C15：屏幕级标题——错峰 + Blur Text 焦点回落 */}
      <BlurText as="h1" className="intro-title intro-title--sm" text={strings.feast.title} />
      {/* 消息减负审计 E8：标题下副标题行删除——四只盘子 + 账本
          本身就是这一屏的内容 */}
      <div className="feast-table">
        {(state.plates ?? []).map((plate, i) => {
          const p = state.players.find((x) => x.id === plate.playerId)!;
          const recipe = p.recipeId ? getRecipe(p.recipeId) : null;
          return (
            <AnimatedContent
              key={plate.playerId}
              ref={(el) => {
                if (el) plateRefs.current.set(plate.playerId, el);
                else plateRefs.current.delete(plate.playerId);
              }}
              variant="pop"
              delay={i * 60}
              className={`plate-card plate-card--${plate.kind}${plate.kind === 'full' ? ' card-foil' : ''}`}
              style={
                // T-1：盘卡底色 = 菜品插画底色（与 CardView 同口径）
                (recipe ? { '--card-bg': cardBgFor(recipe.id) } : {}) as CSSProperties
              }
              testid={`plate-${plate.playerId}`}
            >
              <span className={`plate-disc plate-disc--${plate.kind}`} aria-hidden="true">
                {recipe && cardArtFor(recipe.id) ? (
                  <img className="plate-art" src={cardArtFor(recipe.id)} alt="" draggable={false} />
                ) : (
                  <CardIcon icon={recipe?.icon ?? '🍽️'} />
                )}
              </span>
              <span className="plate-name">{playerDisplayName(p)}</span>
              <span className="plate-dish">{recipe ? cardName(recipe.id) : '—'}</span>
              <span className="plate-kind">{kindLabel(plate.kind)}</span>
              <span className="plate-note">{plateNote(plate)}</span>
            </AnimatedContent>
          );
        })}
      </div>
      <div className="feast-actions">
        <Button
          variant="primary"
          keyHint="1"
          data-testid="action-primary"
          data-primary="true"
          data-key={1}
          onClick={() => setShowLedger(true)}
        >
          {strings.feast.ledgerBtn}
        </Button>
        {/* 交互审 U8：「再玩一局」已撤——盛宴桌是全班看结果的时刻，
            一键重开会把刚端上桌的四盘菜瞬间清掉；重开留在反思页
            终点与演示条里（老师掌控的时刻） */}
      </div>
    </main>
  );
}
