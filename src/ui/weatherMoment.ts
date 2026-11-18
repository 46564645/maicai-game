/**
 * weatherMoment.ts —— R10 Slice E（§2）：天气电影时刻的纯状态机。
 *
 * 节拍（owner 序列）：转盘推近 → 转盘转 → 天气大卡在世界中心弹出 →
 * 孩子点掉 → 世界换上天气 → 相机缓回 → 继续玩。
 * 引擎结果（turn.sub.weatherId）永远是权威——本机只管 DOM/3D 演出
 * 节奏，不碰结果与时序。三个相位：
 *   'spin' 转盘演出中（3D 推近 + DOM 轮盘转）
 *   'card' 落定，天气大卡浮在世界中心等点
 *   'done' 点掉，世界换天气，事件流程继续（牌堆→故事卡→选项）
 */
export type WeatherMomentPhase = 'spin' | 'card' | 'done';

/** 3D 布景/世界色调用的天气种别（cards.json 的 wth-* → 三态） */
export type WeatherDress = 'sunny' | 'rainy' | 'windy' | null;

/** 相位推进：落定进大卡、点掉收工；其余事件不迁移 */
export function nextWeatherPhase(
  phase: WeatherMomentPhase,
  ev: 'landed' | 'tap',
): WeatherMomentPhase {
  if (phase === 'spin' && ev === 'landed') return 'card';
  if (phase === 'card' && ev === 'tap') return 'done';
  return phase;
}

/** 大卡浮出前的转盘演出时长：贴 DOM 轮盘 --wheel-ms(1300) 再留一拍落定；
 *  reduced-motion 不是砍掉，是把整段缩到一次眨眼 */
export function weatherCardDelayMs(reducedMotion: boolean): number {
  return reducedMotion ? 160 : 1500;
}

/** 大卡弹出动画时长（配合 .moment-card 入场）：reduced 保留弹入但更快更柔 */
export function weatherCardPopMs(reducedMotion: boolean): number {
  return reducedMotion ? 140 : 340;
}

/** R1-E3：bot 天气简版——3D 转盘直落（不推近、不整圈转），DOM 侧世界
 * 换布景（Game 的自动定时）只需留一拍让结果被看见，400ms 即换，
 * 与 3D 直落对齐（旧值 1900ms 是按真人整圈演出定的，bot 不再等它） */
export function botWeatherSettleMs(): number {
  return 400;
}

/** 天气卡 id → 布景种别：世界灯光/色调/雨丝/云速共用一份映射 */
export function weatherDressFor(weatherId: string | null | undefined): WeatherDress {
  if (weatherId === 'wth-sunny') return 'sunny';
  if (weatherId === 'wth-rainy') return 'rainy';
  if (weatherId === 'wth-windy') return 'windy';
  return null;
}
