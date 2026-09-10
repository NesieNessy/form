export const colors = {
  bg: '#080D12',
  bgElevated: '#0D141B',
  card: '#131C24',
  cardAlt: '#19252F',
  border: '#26343F',
  borderStrong: 'rgba(245,247,248,0.18)',

  text: '#F5F7F8',
  textSecondary: '#9BA8B4',
  textTertiary: '#5D6872',

  // Semantic data colors — each metric type keeps the same color everywhere.
  blue: '#3693FF', // Body weight
  purple: '#755BEF', // Strength
  pink: '#E86F91', // Body fat
  orange: '#F09562', // Training load / calories
  teal: '#55B8A5', // Endurance / performance
  red: '#FF5C5C', // Heart rate

  // Supplementary accents (chart-series differentiation, state colors).
  green: '#3DDC84',
  amber: '#F5B942',

  // Very faint reference lines inside charts — restrained by design.
  chartGrid: 'rgba(245,247,248,0.07)',

  // The FORM gradient — the brand's one signature gradient. Reserve it for
  // the logo, primary actions, active nav, progress indicators, FORM Score,
  // and key insights. Don't scatter it across the rest of the UI.
  gradient: ['#3693FF', '#755BEF', '#E86F91', '#F09562', '#55B8A5'],
} as const;

export const radius = {
  sm: 10,
  md: 14,
  card: 16,
  button: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

// 8-point grid. `screenX` is mobile horizontal padding, `cardGap` is the gap
// between cards, `md` doubles as internal card padding... see usage below.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  screenX: 20,
  cardGap: 12,
  cardPadding: 16,
  section: 28,
};

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

// Typographic hierarchy from the FORM design system. Sizes are the midpoint
// of the spec's suggested ranges.
export const typography = {
  heroMetric: { fontSize: 44, fontFamily: fontFamily.semibold },
  pageTitle: { fontSize: 30, fontFamily: fontFamily.semibold },
  sectionTitle: { fontSize: 21, fontFamily: fontFamily.semibold },
  cardTitle: { fontSize: 16.5, fontFamily: fontFamily.semibold },
  body: { fontSize: 15.5, fontFamily: fontFamily.regular },
  metric: { fontSize: 21, fontFamily: fontFamily.semibold },
  caption: { fontSize: 12.5, fontFamily: fontFamily.regular },
  microLabel: { fontSize: 10.5, fontFamily: fontFamily.medium, letterSpacing: 0.4 },
} as const;

// Default stroke width for the lucide-react-native outline icon set.
export const iconStrokeWidth = 1.75;
