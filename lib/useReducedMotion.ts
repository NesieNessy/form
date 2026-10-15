import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the device asks for less motion; screens then switch instead of sliding and toasts appear without fading. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduced(on))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
