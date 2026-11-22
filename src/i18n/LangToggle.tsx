/**
 * LangToggle.tsx —— R6 中英文切换钮（右上角）。WS4 E7：收编
 * RubberSegment（React Bits，MIT + Commons Clause，已登记
 * THIRD_PARTY_NOTICES.md）——两段开关的选中底从「段自画橙底」改为
 * 一条橡皮筋胶囊拇指：切换时按弹簧形变滑向新段；按住选中段可拖动、
 * 松手吸附最近段。prefers-reduced-motion 直接到终态无形变。
 *
 * 硬约束逐项保留（对照改版前行为）：
 * - 中/EN 两段标签恒显 ≥14px（字面量 + .lang-toggle-seg 的
 *   --font-size-md 不变）；每段点击区 ≥48px（min-width 52px +
 *   min-height --tap-min-size 不变）；仍是原生 <button> 可键盘。
 * - 同一状态/持久化：useLang() 读、setLang() 写（i18n/store，
 *   localStorage 口径不变）；两种语言模式下渲染完全一致
 *   （标签是字面量，不随语言变）。
 * - 放置钩子不变：.lang-toggle（竖栏 sticky）/ .lang-toggle--corner
 *   （固定右上）、data-testid / data-lang 全保留；段尺寸仍走
 *   .lang-toggle-seg 既有规则——本组件只把「组+段自画选中底」换成
 *   「radiogroup + 橡皮拇指」，段选中字色由 .rubber-segment__item--on
 *   附加块承担（.lang-toggle-seg--on 规则闲置不删，归既有块）。
 *
 * 放置（不新增棋盘遮挡，见 I18N_R6.md 实测）：
 * - 桌面/平板游戏屏：进顶栏右侧动作区（与「设置 / 玩法」同排，文档流内）；
 * - 手机横屏游戏屏：右竖栏顶部 sticky（竖栏是既有 chrome，不占岛面）；
 * - 其余屏（开场/选角色/篮子/开饭/反思）：App 固定右上角（--corner 变体，
 *   这些屏没有棋盘岛，右上角是空白）。
 */
import { setLang, useLang, type Lang } from './store';
import { RubberSegment } from '../components/RubberSegment';

export function LangToggle({ corner = false }: { corner?: boolean }) {
  const lang = useLang();
  return (
    <RubberSegment
      className={'lang-toggle' + (corner ? ' lang-toggle--corner' : '')}
      itemClassName="lang-toggle-seg"
      itemOnClassName="rubber-segment__item--on"
      items={[
        { value: 'zh', label: '中文', ariaLabel: '中文' },
        { value: 'en', label: 'EN', ariaLabel: 'English' },
      ]}
      value={lang}
      onChange={(v) => setLang(v as Lang)}
      ariaLabel="Language / 语言"
      testid="lang-toggle"
      dataExtra={{ 'data-lang': lang }}
    />
  );
}
