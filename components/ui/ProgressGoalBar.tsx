import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme/colors';

type Props = {
  label: string;
  currentLabel: string;
  targetLabel: string;
  progressPct: number;
};

export function ProgressGoalBar({ label, currentLabel, targetLabel, progressPct }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.target}>
          Aktuell: <Text style={styles.targetValue}>{currentLabel}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={colors.logoGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(4, Math.min(100, progressPct))}%` }]}
        />
      </View>
      <Text style={styles.goalLabel}>Ziel: {targetLabel} · {progressPct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: '700',
  },
  target: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  targetValue: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  goalLabel: {
    color: colors.textTertiary,
    fontSize: 11.5,
    marginTop: 6,
  },
});
