import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '@/theme/colors';

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
          Current: <Text style={styles.targetValue}>{currentLabel}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(4, Math.min(100, progressPct))}%` }]}
        />
      </View>
      <Text style={styles.goalLabel}>Target: {targetLabel} · {progressPct}%</Text>
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
    fontFamily: fontFamily.bold,
  },
  target: {
    color: colors.textTertiary,
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  targetValue: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bold,
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
    fontFamily: fontFamily.regular,
  },
});
