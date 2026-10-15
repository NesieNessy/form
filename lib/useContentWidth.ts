import { useWindowDimensions } from 'react-native';
import { layout } from '@/theme/colors';

/**
 * The width of a pushed screen's content column. On phones it is the window
 * width; on tablets and desktops screens opened from the tabs are centred at
 * most `layout.pageMaxWidth` wide (app/_layout.tsx), so charts sized from
 * this fit the column instead of the window.
 */
export function useContentWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width, layout.pageMaxWidth);
}
