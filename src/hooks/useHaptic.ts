'use client';

export function useHaptic() {
  const trigger = (type: 'light' | 'medium' | 'heavy' | 'success') => {
    if (typeof window === 'undefined' || !window.navigator || !window.navigator.vibrate) {
      return;
    }

    try {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(30);
          break;
        case 'heavy':
          navigator.vibrate(50);
          break;
        case 'success':
          navigator.vibrate([10, 50, 20]);
          break;
      }
    } catch (e) {
      // Ignore vibration errors
    }
  };

  return trigger;
}
