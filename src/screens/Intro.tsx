/**
 * Intro.tsx —— 开场：标题 + 开始（可跳过）。消息减负审计 A4/A5/A6：
 * 宣传语、开局数字卡、「选一位小伙伴…」提示行全删——数字卡迁入
 * 新手指南第 3 页（strings.intro.statCards 键保留复用），开场只剩
 * 标题 + 开始钮 + 构建戳（A7 保留）。
 */
import { strings } from '../data/strings';
import type { Command } from '../game/types';
import { Button } from '../components/Button';
import { GradientText } from '../components/reactbits/GradientText';

/* E1（React Bits "Gradient Text"）：开场标题的活渐变。全停靠色
   派生自暖橙色板，最亮端 ≥3:1（大字号展示体底线）、最深 5.18:1
   ——渐变扫到任何位置标题都清晰可读，无外来色。 */
const TITLE_GRADIENT = [
  'var(--color-primary-deep)',
  'color-mix(in srgb, var(--color-primary) 70%, var(--color-primary-deep))',
  'var(--color-primary-lo)',
];

export function Intro({ send }: { send: (c: Command) => unknown }) {
  return (
    <main className="intro-shell" data-testid="screen-intro">
      <h1 className="intro-title">
        <GradientText colors={TITLE_GRADIENT}>{strings.title}</GradientText>
      </h1>

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

      {/* 构建戳（ww 网页审核）：开始页角落小字标版本，低调、不占
          版面、不进游戏流程；commit 由构建注入，拿不到显示 dev */}
      <span className="build-stamp" aria-hidden="true">
        build {__BUILD_COMMIT__}
      </span>
    </main>
  );
}
