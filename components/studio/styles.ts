import { StyleSheet } from 'react-native';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

/** Shared look of the studio panels. */
export const s = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  section: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  value: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  day: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.cardAlt },
  pillText: { color: colors.text, fontSize: 12.5, fontFamily: fontFamily.semibold },
  link: { color: colors.blue, fontSize: 13, fontFamily: fontFamily.semibold },
  danger: { color: colors.red, fontSize: 13, fontFamily: fontFamily.semibold },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  dateValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginLeft: 'auto' },
});
