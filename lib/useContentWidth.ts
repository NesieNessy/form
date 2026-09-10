import { Platform, useWindowDimensions } from 'react-native';
import { layout } from '@/theme/colors';

/**
 * The actual rendered width of the app's content column. On native and on
 * narrow web viewports this is just the window width, but on a desktop
 * browser the app is visually constrained to `layout.containerMaxWidth`
 * (see app/_layout.tsx) — screens that size charts off the window width
 * must use this instead of `useWindowDimensions()` directly, or their
 * charts will be sized for the full browser window and get clipped.
 */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= layout.desktopBreakpoint;
  return isDesktopWeb ? layout.containerMaxWidth : width;
}
