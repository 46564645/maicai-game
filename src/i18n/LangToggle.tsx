/**
 * LangToggle.tsx —— R6 中英文切换钮（右上角）。
 *
 * 两段式胶囊：[中文][EN]，当前语言高亮。每段高度 ≥48px（--tap-min-size），
 * 触控区达标。放置（不新增棋盘遮挡，见 I18N_R6.md 实测）：
 * - 桌面/平板游戏屏：进顶栏右侧动作区（与「设置 / 玩法」同排，文档流内）；
 * - 手机横屏游戏屏：右竖栏顶部 sticky（竖栏是既有 chrome，不占岛面）；
 * - 其余屏（开场/选角色/篮子/开饭/反思）：App 固定右上角（--corner 变体，
 *   这些屏没有棋盘岛，右上角是空白）。
 */
import { setLang, useLang } from './store';

export function LangToggle({ corner = false }: { corner?: boolean }) {
  const lang = useLang();
  return (
    <div
      className={'lang-toggle' + (corner ? ' lang-toggle--corner' : '')}
      role="group"
      aria-label="Language / 语言"
      data-testid="lang-toggle"
      data-lang={lang}
    >
      <button
        type="button"
        className={'lang-toggle-seg' + (lang === 'zh' ? ' lang-toggle-seg--on' : '')}
        aria-pressed={lang === 'zh'}
        onClick={() => setLang('zh')}
      >
        中文
      </button>
      <button
        type="button"
        className={'lang-toggle-seg' + (lang === 'en' ? ' lang-toggle-seg--on' : '')}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  );
}
