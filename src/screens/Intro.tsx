/**
 * Intro.tsx —— 开场：标题 + 一句话 + 4 个开局数字卡 + 开始（可跳过）。
 */
import { gameConfig } from '../config/gameConfig';
import { strings } from '../data/strings';
import type { Command } from '../game/types';
import { Button } from '../components/Button';

export function Intro({ send }: { send: (c: Command) => unknown }) {
  const stats = [
    { value: gameConfig.startCoins, ...strings.intro.statCards.startCoins },
    { value: gameConfig.recipeTotal, ...strings.intro.statCards.recipeTotal },
    { value: gameConfig.busFeeByLap.reduce((a, b) => a + b, 0), ...strings.intro.statCards.busFee },
    { value: gameConfig.freeCoins, ...strings.intro.statCards.freeCoins },
  ];

  return (
    <main className="intro-shell" data-testid="screen-intro">
      <h1 className="intro-title">{strings.title}</h1>
      <p className="intro-tagline">{strings.tagline}</p>

      <div className="intro-stats" role="list">
        {stats.map((s) => (
          <div className="stat-card" role="listitem" key={s.label}>
            <span className="stat-card-value">
              {s.value}
              <span className="stat-card-unit"> {s.suffix}</span>
            </span>
            <span className="stat-card-label">{s.label}</span>
          </div>
        ))}
      </div>

      <Button
        variant="primary"
        data-testid="action-primary"
        data-primary="true"
        data-key={1}
        aria-label={strings.intro.startButton}
        onClick={() => send({ type: 'START_GAME' })}
      >
        {strings.intro.startButton}
      </Button>

      <p className="intro-hint" aria-live="polite">
        {strings.intro.startHint}
      </p>

      {/* 构建戳（ww 网页审核）：开始页角落小字标版本，低调、不占
          版面、不进游戏流程；commit 由构建注入，拿不到显示 dev */}
      <span className="build-stamp" aria-hidden="true">
        build {__BUILD_COMMIT__}
      </span>
    </main>
  );
}
