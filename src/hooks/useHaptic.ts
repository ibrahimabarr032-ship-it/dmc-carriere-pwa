import { useCallback } from 'react';

/**
 * Hook React pour déclencher des retours haptiques silencieux
 * (vibration matérielle sur mobile via Vibration API sans aucun son ni AudioContext).
 * 
 * @returns {{ triggerHaptic: (pattern?: 'tap' | 'success' | 'warning' | 'error') => void }}
 */
export function useHaptic() {
  const triggerHaptic = useCallback((pattern: 'tap' | 'success' | 'warning' | 'error' = 'tap') => {
    // Vibration physique silencieuse uniquement sur appareils mobiles compatibles
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        switch (pattern) {
          case 'tap':
            navigator.vibrate(30);
            break;
          case 'success':
            navigator.vibrate([40, 30, 60]);
            break;
          case 'warning':
            navigator.vibrate([80, 40, 80]);
            break;
          case 'error':
            navigator.vibrate([100, 60, 100]);
            break;
        }
      } catch {
        // Silencieux si vibration non supportée
      }
    }
  }, []);

  return { triggerHaptic };
}

