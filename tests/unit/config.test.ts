import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config/gameConfig';

describe('gameConfig', () => {
  it('开局数字自洽：12 = 6 菜 + 2 车费 + 4 自由', () => {
    expect(gameConfig.startCoins).toBe(12);
    expect(gameConfig.recipeTotal).toBe(6);
    expect(gameConfig.busFeeByLap.reduce((a, b) => a + b, 0)).toBe(2);
    expect(gameConfig.freeCoins).toBe(4);
  });

  it('8 个站点，顺序固定，每站带「练·」目标', () => {
    expect(gameConfig.stations.length).toBe(8);
    for (const s of gameConfig.stations) {
      expect(s.goal.startsWith('Practice'), s.id).toBe(true);
    }
  });

  it('3 圈；玩家 1 真人 + 3 电脑', () => {
    expect(gameConfig.laps).toBe(3);
    expect(gameConfig.playerCount).toBe(4);
    expect(gameConfig.humanCount).toBe(1);
  });

  it('伙伴站一起买：分钱开关默认各付各的份', () => {
    expect(gameConfig.partner.jointBuySplit).toBe('eachPaysOwnShare');
  });
});
