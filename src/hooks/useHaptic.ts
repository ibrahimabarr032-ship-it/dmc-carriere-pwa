import { useCallback } from 'react';

export function useHaptic() {
  const triggerHaptic = useCallback((pattern: 'tap' | 'success' | 'warning' | 'error' = 'tap') => {
    // 1. Mobile Device Vibration API
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (pattern) {
          case 'tap':
            navigator.vibrate(35);
            break;
          case 'success':
            navigator.vibrate([50, 40, 90]);
            break;
          case 'warning':
            navigator.vibrate([100, 50, 100]);
            break;
          case 'error':
            navigator.vibrate([150, 80, 150, 80, 200]);
            break;
        }
      } catch {
        // Ignore if device blocks vibration
      }
    }

    // 2. Subtle Web Audio Feedback (for PC and Mobile devices without vibration)
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (pattern === 'tap') {
          osc.frequency.setValueAtTime(420, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        } else if (pattern === 'success') {
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.06); // A5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
          osc.start();
          osc.stop(ctx.currentTime + 0.16);
        }
      } catch {
        // Audio fallback silent fail
      }
    }
  }, []);

  return { triggerHaptic };
}
