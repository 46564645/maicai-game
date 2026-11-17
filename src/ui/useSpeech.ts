/**
 * useSpeech.ts —— speechSynthesis 朗读。探测不可用时 supported=false，
 * 调用方据此隐藏 🔊（朗读是增强，不作必要路径，PLAN §5 歧义 20）。
 */
import { useCallback } from 'react';
import { getLang } from '../i18n/store';

export function useSpeech() {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = getLang() === 'zh' ? 'zh-CN' : 'en-US';
        window.speechSynthesis.speak(u);
      } catch {
        /* 静默降级：朗读不可用不阻断游戏 */
      }
    },
    [supported],
  );

  return { supported, speak };
}
