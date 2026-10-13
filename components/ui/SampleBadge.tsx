import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius } from '@/theme/colors';

/**
 * Marks figures that are bundled demo values rather than the athlete's own
 * data, so a placeholder is never mistaken for a measurement.
 */
export function SampleBadge({ explain, style }: { explain?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{strings.sampleData}</Text>
      </View>
      {explain ? <Text style={styles.body}>{strings.sampleDataBody}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: `${colors.amber}22`,
  },
  pillText: { color: colors.amber, fontSize: 10.5, fontFamily: fontFamily.bold, letterSpacing: 0.3 },
  body: { flexShrink: 1, color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
});
