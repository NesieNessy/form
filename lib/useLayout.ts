import { useWindowDimensions } from 'react-native';
import { layout } from '@/theme/colors';

export type LayoutSize = 'mobile' | 'tablet' | 'desktop';

/** Which of the three layouts applies at the current window width. */
export function useLayout(): { size: LayoutSize; width: number; wide: boolean } {
  const { width } = useWindowDimensions();
  const size: LayoutSize = width >= layout.desktopBreakpoint ? 'desktop' : width >= layout.tabletBreakpoint ? 'tablet' : 'mobile';
  return { size, width, wide: size !== 'mobile' };
}
