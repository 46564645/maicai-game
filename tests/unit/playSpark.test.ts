/**
 * playSpark.test.ts —— R10 Slice B PlaySpark：全局并发上限 3（§4.4），
 * 超出即丢弃；node 测试环境无 DOM 时 playSpark/playSparkAt 静默无操作
 * （不得抛错——面板在任何环境下调它都安全）。
 */
import { describe, expect, it } from 'vitest';
import {
  playSpark,
  playSparkAt,
  sparkActiveCount,
  sparkAllowed,
} from '../../src/components/cards/PlaySpark';

describe('PlaySpark 并发闸门', () => {
  it('并发 <3 放行，达到 3 即丢弃', () => {
    expect(sparkAllowed(0)).toBe(true);
    expect(sparkAllowed(1)).toBe(true);
    expect(sparkAllowed(2)).toBe(true);
    expect(sparkAllowed(3)).toBe(false);
    expect(sparkAllowed(9)).toBe(false);
  });

  it('无 DOM 环境调用不抛错、不占并发', () => {
    expect(sparkActiveCount()).toBe(0);
    expect(() => playSpark(10, 20)).not.toThrow();
    expect(() => playSparkAt(null)).not.toThrow();
    expect(() => playSparkAt({} as Element)).not.toThrow();
    expect(sparkActiveCount()).toBe(0);
  });
});
