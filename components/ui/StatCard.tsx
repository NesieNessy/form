import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { SampleBadge } from './SampleBadge';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  direction?: 'up' | 'down';
  style?: object;
  /** True when the figure is a bundled demo value, not the athlete's own data. */
  sample?: boolean;
};

export function StatCard({ label, value, delta, positive = true, direction = 'down', style, sample }: Props) {
  return (
    <Card style={[styles.card, style]}>
      {sample ? <SampleBadge /> : null}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta ? (
        <View style={styles.deltaRow}>
          {direction === 'down' ? (
            <Icons.arrowDown size={12} strokeWidth={iconStrokeWidth} color={positive ? colors.green : colors.red} />
          ) : (
            <Icons.arrowUp size={12} strokeWidth={iconStrokeWidth} color={positive ? colors.green : colors.red} />
          )}
          <Text style={[styles.delta, { color: positive ? colors.green : colors.red }]}>
            {delta}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '47%',
    gap: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fontFamily.medium,
  },
  value: {
    color: colors.text,
    fontSize: 19,
    fontFamily: fontFamily.bold,
    marginTop: 2,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  delta: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
  },
});
