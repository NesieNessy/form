import { readPreference, systemScheme } from '@/lib/preferences';

/**
 * FORM design tokens (docs/concepts/12-form-brand-design-system.md and
 * form-design-tokens.css). Three layers:
 *
 * 1. Brand primitives: the seven exact stops of the logo gradient. They are
 *    for the logo and rare brand moments, never for status, roles or charts.
 * 2. Semantic tokens per theme: surfaces, text, borders, the solid action
 *    colour, focus and status colours. Checked for contrast in
 *    theme/contrast.test.ts.
 * 3. Data accents: one colour per metric type, adjusted per theme so they
 *    stay readable; always paired with a label, never colour alone.
 *
 * The theme is chosen once at start-up (setting, else the device), because
 * styles across the app are built when their screen loads. Changing it
 * reloads the web app and applies on phones the next time the app opens.
 */

export const brand = {
  indigo: '#2F4F93',
  blue: '#2E78D2',
  violet: '#6B55B2',
  berry: '#B4467B',
  orange: '#E2764E',
  gold: '#B1A25F',
  teal: '#28A59C',
} as const;
export const brandGradient = {
  colors: [brand.indigo, brand.blue, brand.violet, brand.berry, brand.orange, brand.gold, brand.teal] as const,
  locations: [0, 0.18, 0.36, 0.52, 0.68, 0.84, 1] as const,
};

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = 'system' | ThemeMode;

type Palette = {
  bg: string;
  bgElevated: string;
  card: string;
  cardAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  action: string;
  onAction: string;
  focus: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  blue: string;
  purple: string;
  pink: string;
  orange: string;
  teal: string;
  red: string;
  green: string;
  amber: string;
  chartGrid: string;
  overlay: string;
  gradient: typeof brandGradient.colors;
};

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    bg: '#0B1220',
    bgElevated: '#0F1828',
    card: '#121D30',
    cardAlt: '#1B2A41',
    border: '#34445B',
    borderStrong: '#6C809C',
    text: '#F3F7FD',
    textSecondary: '#B5C4D7',
    textTertiary: '#93A3B9',
    action: '#91B8FF',
    onAction: '#0B1220',
    focus: '#A4C5FF',
    success: '#85D6AE',
    warning: '#FFD08B',
    danger: '#FF9CA6',
    info: '#9CC8FF',
    blue: '#9CC8FF',
    purple: '#BBA9FF',
    pink: '#F5A3C7',
    orange: '#FFB48C',
    teal: '#6FD3C8',
    red: '#FF9CA6',
    green: '#85D6AE',
    amber: '#FFD08B',
    chartGrid: 'rgba(243,247,253,0.08)',
    overlay: 'rgba(5,9,16,0.7)',
    gradient: brandGradient.colors,
  },
  light: {
    bg: '#F7F9FC',
    bgElevated: '#F2F5FA',
    card: '#FFFFFF',
    cardAlt: '#EFF3F9',
    border: '#D9E1EC',
    borderStrong: '#7A889D',
    text: '#17243A',
    textSecondary: '#50617B',
    textTertiary: '#5C6B82',
    action: '#254B9A',
    onAction: '#FFFFFF',
    focus: '#2254B7',
    success: '#166540',
    warning: '#8B4900',
    danger: '#B42335',
    info: '#2458A6',
    blue: '#2458A6',
    purple: '#5B45A8',
    pink: '#A13A6C',
    orange: '#A34A1C',
    teal: '#17716B',
    red: '#B42335',
    green: '#166540',
    amber: '#8B4900',
    chartGrid: 'rgba(23,36,58,0.08)',
    overlay: 'rgba(23,36,58,0.45)',
    gradient: brandGradient.colors,
  },
};

const stored = readPreference('theme');
export const themePreference: ThemePreference = stored === 'light' || stored === 'dark' ? stored : 'system';
export const themeMode: ThemeMode = themePreference === 'system' ? systemScheme() : themePreference;

export const colors: Palette = palettes[themeMode];

export const radius = {
  sm: 8,
  md: 10,
  card: 12,
  button: 10,
  lg: 16,
  xl: 16,
  pill: 999,
};

// 4-point scale. `screenX` is the horizontal page gutter.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenX: 16,
  cardGap: 12,
  cardPadding: 16,
  section: 32,
};

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

/** Numbers that change or are compared (timers, pace, load, nutrition) keep their width. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

// Type scale from the brand spec: Display 40/44, H1 32/38, H2 24/30, H3 20/26, Body 16/24, Small 14/20, Caption 12/16.
export const typography = {
  heroMetric: { fontSize: 40, lineHeight: 44, fontFamily: fontFamily.semibold, ...tabular },
  pageTitle: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.semibold },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.semibold },
  cardTitle: { fontSize: 16, lineHeight: 22, fontFamily: fontFamily.semibold },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  metric: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.semibold, ...tabular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.regular },
  microLabel: { fontSize: 12, lineHeight: 16, fontFamily: fontFamily.medium, letterSpacing: 0.4 },
} as const;

// Default stroke width for the lucide-react-native outline icon set.
export const iconStrokeWidth = 1.75;

/** Touch targets: at least 44 points, 48 to 56 for the workout player's key actions. */
export const touch = { min: 44, player: 52 };

// On web, above this window width we treat the browser as desktop and
// constrain the app to a phone-width column (see app/_layout.tsx and
// lib/useContentWidth.ts) instead of stretching it edge to edge.
export const layout = {
  desktopBreakpoint: 700,
  containerMaxWidth: 840,
};
