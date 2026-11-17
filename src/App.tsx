/**
 * App.tsx —— useGame + useBotDriver + 按 phase 路由屏幕 + 覆盖层宿主。
 * 覆盖层：求助卡（H）> 钱包抽屉（W）> 演示条（D）；Esc 关最上层。
 * 演示条：?demo=1 初始打开；D 开合（层栈 'demo' 为准，flags.demo 同步记录）。
 */
import { useEffect, useRef } from 'react';
import type { Command } from './game/types';
import { LangToggle } from './i18n/LangToggle';
import { useLang } from './i18n/store';
import { HelpCard } from './components/HelpCard';
import { RotatePhone } from './components/RotatePhone';
import { WalletDrawer } from './components/WalletDrawer';
import { DemoBar } from './demo/DemoBar';
import { useBotDriver } from './ui/useBotDriver';
import { useGame } from './ui/useGame';
import { useHotkeys } from './ui/useHotkeys';
import { useLayerStack } from './ui/useLayerStack';
import { usePhoneMode } from './ui/usePhoneMode';
import { BasketReview } from './screens/BasketReview';
import { CharacterSelect } from './screens/CharacterSelect';
import { Feast } from './screens/Feast';
import { Game } from './screens/Game';
import { Intro } from './screens/Intro';
import { Reflection } from './screens/Reflection';

export default function App() {
  const { state, send } = useGame();
  // R6：根组件订阅语言 —— 切换时整棵树重渲染，全部文案立即换语言
  // （游戏状态不动）；游戏屏的切换钮在 Game 的顶栏/竖栏里，其余屏
  // 用固定右上角变体（见 LangToggle）。
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);
  useBotDriver(state, send);
  const layers = useLayerStack();
  // 手机判定只影响「小屏触屏设备」（M4.5.6）：竖屏 → 旋转提示层；
  // 横屏 → 右竖栏布局（app-shell--phone-land）。电脑/平板不受影响。
  const phoneMode = usePhoneMode();

  // 演示条只在 URL 带 ?demo=1 时出现（M4.5.6：正式版默认不显示，
  // D 键不再单独唤出——只在 demo 会话内负责开合）
  const demoAllowed = useRef(
    new URLSearchParams(window.location.search).get('demo') === '1',
  ).current;

  // ?demo=1：挂载时自动打开演示条
  useEffect(() => {
    if (state.flags.demo) layers.openLayer('demo');
    // 仅初始一次；之后由 D 键/层栈控制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demoOpen = demoAllowed && layers.isOpen('demo');
  const toggleDemo = () => {
    if (!demoAllowed) return;
    const next = !layers.isOpen('demo');
    layers.toggleLayer('demo');
    if (state.flags.demo !== next) {
      send({ type: 'SET_FLAG', flag: 'demo', value: next });
    }
  };

  const toggleHelp = () => {
    if (!layers.isOpen('help')) send({ type: 'TOGGLE_HELP' }); // 计次不展示
    layers.toggleLayer('help');
  };
  useHotkeys({
    closeTopLayer: layers.closeTop,
    toggleWallet: () => layers.toggleLayer('wallet'),
    toggleHelp,
    toggleDemo,
  });

  const human = state.players.find((p) => p.isHuman)!;
  const sendCmd = (c: Command) => send(c);

  return (
    <div
      className={
        'app-shell' + (phoneMode === 'phone-landscape' ? ' app-shell--phone-land' : '')
      }
    >
      {demoOpen && <DemoBar state={state} send={send} onClose={toggleDemo} />}

      {state.phase !== 'station' && <LangToggle corner />}

      {state.phase === 'intro' && <Intro send={sendCmd} />}
      {state.phase === 'chooseCharacter' && <CharacterSelect send={sendCmd} />}
      {state.phase === 'station' && (
        <Game
          state={state}
          send={sendCmd}
          onOpenHelp={toggleHelp}
          onOpenWallet={() => layers.openLayer('wallet')}
        />
      )}
      {state.phase === 'basket' && <BasketReview state={state} send={sendCmd} />}
      {state.phase === 'feast' && <Feast state={state} send={sendCmd} />}
      {(state.phase === 'reflection' || state.phase === 'finished') && (
        <Reflection state={state} send={sendCmd} />
      )}

      {layers.isOpen('wallet') && (
        <WalletDrawer
          state={state}
          playerId={human.id}
          onClose={() => layers.closeLayer('wallet')}
        />
      )}

      {layers.isOpen('help') && (
        <HelpCard
          state={state}
          playerId={human.id}
          onClose={() => layers.closeLayer('help')}
        />
      )}

      {/* 手机竖屏：全屏「把手机横过来」循环动画，转横后自动进入游戏 */}
      {phoneMode === 'phone-portrait' && <RotatePhone />}
    </div>
  );
}
