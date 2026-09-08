import { useCallback } from 'react';

type AudioCtxCtor = typeof AudioContext;
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtxCtor | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume();
  }
  return sharedCtx;
}

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
    const ctx = getAudioContext();
    if (ctx) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // Safe cleanup
          }
        };

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
