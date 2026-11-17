/**
 * WeatherSpinner.tsx —— 天气转盘（唯一转盘，不决定步数）。
 * 结果由引擎先定（sub.weatherId），本组件只负责演出：CSS 旋转 → 停在结果，
 * prefers-reduced-motion 时直接停在结果不做动画。
 */
import type { CSSProperties } from 'react';
import { cards } from '../data/cards';
import { strings } from '../data/strings';
import { fmt } from '../game/stations/shared';
import { cardName } from '../i18n/cardText';
import type { CardId } from '../game/types';

export function WeatherSpinner({ weatherId }: { weatherId: CardId | null }) {
  const items = cards.weather;
  const n = items.length;
  const idx = Math.max(0, items.findIndex((w) => w.id === weatherId));
  const step = 360 / n;
  // 转两圈后让目标停在顶部指针：轮盘转 (720 - idx*step)，
  // 图标反向补偿保持选中项水平。
  const endDeg = 720 - idx * step;
  const landed = items[idx];
  return (
    <div
      className="weather-spin"
      data-testid="weather-spinner"
      role="img"
      aria-label={fmt(strings.event.spunTo, { name: landed ? cardName(landed.id) : '' })}
    >
      <div className="weather-dial">
        <span className="weather-pointer" aria-hidden="true">
          ▼
        </span>
        <div
          className="weather-wheel"
          style={{ '--spin-end': `${endDeg}deg` } as CSSProperties}
        >
          {items.map((w, i) => (
            <span
              key={w.id}
              className="weather-wheel-item"
              style={
                {
                  '--item-deg': `${i * step}deg`,
                  '--item-upright': `${(idx - i) * step}deg`,
                } as CSSProperties
              }
            >
              <span className="weather-wheel-icon">{w.icon}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="weather-result">{fmt(strings.event.spunTo, { name: landed ? cardName(landed.id) : '' })}</p>
    </div>
  );
}
