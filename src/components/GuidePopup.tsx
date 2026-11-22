/**
 * GuidePopup.tsx —— 新手指南（消息减负审计 §4 替代旧 HelpCard）：
 * 只讲全游戏通用的静态知识，永远不显示当前局的动态状态。
 * 结构 = StationPopup 壳 → FadeContent 入场 → React Bits Stepper 分页。
 * 共 4 页，每页 = 一个大视觉 + 最多一句短句；步点不带文字标签，
 * 避免步轨再生成一排消息。触发（开局弹一次）与右上角重开入口在
 * App / Game 侧，本组件只负责呈现与关页。
 */
import { useState } from 'react';
import { getIngredient, getRecipe, recipeMarketTotal } from '../data/cards';
import { gameConfig } from '../config/gameConfig';
import { strings } from '../data/strings';
import { fmt, marketPriceOf } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import { CardView } from './CardView';
import { CoinBar, CoinMath } from './cards/CoinBar';
import { MetaIcon } from './cards/MetaIcon';
import { FadeContent } from './motion/FadeContent';
import { Stepper } from './reactbits/Stepper';
import { StationPopup } from './StationPopup';

/** 指南里的小卡视觉（非交互，尺寸收进视觉带） */
function GuideCard({ id, selected = false }: { id: string; selected?: boolean }) {
  const ing = getIngredient(id);
  const recipe = getRecipe(id);
  const price = recipe
    ? recipeMarketTotal(recipe)
    : (marketPriceOf(id) ?? undefined);
  return (
    <span className="guide-card">
      <CardView
        cardId={id}
        icon={ing?.icon ?? recipe?.icon ?? '❔'}
        name={cardName(id)}
        price={price}
        selected={selected}
      />
    </span>
  );
}

export function GuidePopup({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const fishPrice = marketPriceOf('ing-fish') ?? 3;
  const busTotal = gameConfig.busFeeByLap.reduce((a, b) => a + b, 0);
  /* 第 3 页数字片：与 Intro 数字卡同源同值（A5 迁入，键不新造） */
  const stats = [
    { value: gameConfig.startCoins, ...strings.intro.statCards.startCoins },
    { value: gameConfig.recipeTotal, ...strings.intro.statCards.recipeTotal },
    { value: busTotal, ...strings.intro.statCards.busFee },
    { value: gameConfig.freeCoins, ...strings.intro.statCards.freeCoins },
  ];

  const steps = [
    {
      key: 'job',
      pane: (
        <div className="guide-page">
          <h3 className="guide-page-title">{strings.guide.jobTitle}</h3>
          <p className="guide-line">{strings.guide.jobLine}</p>
          {/* 视觉带：一张示例菜谱卡 → 它要的三张食材卡（现有卡图，
              不用玩家自己的菜谱——触发时还没抽卡） */}
          <div className="guide-visual" aria-hidden="true">
            <GuideCard id="rec-tomato-egg" />
            <span className="guide-arrow">→</span>
            <GuideCard id="ing-tomato" />
            <GuideCard id="ing-egg" />
            <GuideCard id="ing-scallion" />
          </div>
        </div>
      ),
    },
    {
      key: 'buy',
      pane: (
        <div className="guide-page">
          <h3 className="guide-page-title">{strings.guide.buyTitle}</h3>
          <p className="guide-line">{strings.guide.buyLine}</p>
          <div className="guide-visual" aria-hidden="true">
            <GuideCard id="ing-fish" selected />
            <span className="btn btn--primary guide-sample-btn">
              <span className="dz-icon" aria-hidden="true">
                🧺
              </span>
              {fmt(strings.panel.buyPriced, { n: fishPrice })}
            </span>
          </div>
          {/* 键盘片（C5/C6 迁入）：视觉元素、非句子——方向键选卡、
              数字键选动作、Enter 进站，开局讲一次即可 */}
          <div className="guide-kbd-row" aria-hidden="true">
            <span className="guide-kbd-group">
              <kbd>←</kbd>
              <kbd>→</kbd>
            </span>
            <span className="guide-kbd-group">
              <kbd>1</kbd>
              <kbd>2</kbd>
              <kbd>3</kbd>
            </span>
            <span className="guide-kbd-group">
              <kbd>Enter</kbd>
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'coins',
      pane: (
        <div className="guide-page">
          <h3 className="guide-page-title">{strings.guide.coinsTitle}</h3>
          <p className="guide-line">{strings.guide.coinsLine}</p>
          {/* 真实金币条 + 一行真实算式（示例数值，与面板同组件） */}
          <div className="guide-visual guide-visual--col" aria-hidden="true">
            <CoinBar
              coins={gameConfig.startCoins}
              missingCost={gameConfig.recipeTotal}
              busDebt={busTotal}
              hideMath
            />
            <CoinMath coins={gameConfig.startCoins} spend={fishPrice} />
          </div>
          <div className="guide-stats" aria-hidden="true">
            {stats.map((s) => (
              <span className="guide-stat" key={s.label}>
                <b>
                  {s.value} {s.suffix}
                </b>
                <i>{s.label}</i>
              </span>
            ))}
          </div>
          <div className="guide-clips" aria-hidden="true">
            <span className="guide-clip">
              <span aria-hidden="true">📎</span> {strings.hud.holdClip}
            </span>
            <span className="guide-clip guide-clip--debt">
              {strings.hud.busDebt}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'marks',
      pane: (
        <div className="guide-page">
          <h3 className="guide-page-title">{strings.guide.marksTitle}</h3>
          <p className="guide-line">{strings.guide.marksLine}</p>
          {/* 三行图例：真实记号 + 现有全名（A11/B10 迁入）；
              指南内的记号只作图例，不挂可见提示泡 */}
          <div className="guide-legend">
            <span className="guide-legend-item">
              <MetaIcon kind="list" />
              {strings.panel.tagNeeded}
            </span>
            <span className="guide-legend-item">
              <MetaIcon kind="food" />
              {strings.panel.tagIngredient}
            </span>
            <span className="guide-legend-item">
              <MetaIcon kind="fun" />
              {strings.panel.tagTemptation}
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <StationPopup title={strings.guide.title} onClose={onClose} testid="card-guide">
      <FadeContent show variant="fade-down" duration={180}>
        <Stepper
          steps={steps}
          step={step}
          onStepChange={(i) => setStep(i + 1)}
          backText={step > 1 ? strings.guide.back : ''}
          nextText={strings.guide.next}
          doneText={strings.guide.done}
          onDone={onClose}
          ariaLabel={strings.guide.title}
        />
      </FadeContent>
    </StationPopup>
  );
}
