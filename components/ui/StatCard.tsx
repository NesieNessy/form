import { ArrowDown, ArrowUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { colors, spacing } from '@/theme/colors';

type Props = {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  direction?: 'up' | 'down';
  style?: object;
};

export function StatCard({ label, value, delta, positive = true, direction = 'down', style }: Props) {
  return (
    <Card style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta ? (
        <View style={styles.deltaRow}>
          {direction === 'down' ? (
            <ArrowDown size={12} color={positive ? colors.green : colors.red} />
          ) : (
            <ArrowUp size={12} color={positive ? colors.green : colors.red} />
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
    fontWeight: '500',
  },
  value: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
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
    fontWeight: '600',
  },
});
