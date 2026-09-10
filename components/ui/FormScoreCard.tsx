import { ArrowUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { ProgressRing } from '@/components/charts/ProgressRing';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';

type Breakdown = { label: string; value: number; color: string };

type Props = {
  score: number;
  rating: string;
  deltaLabel: string;
  breakdown: Breakdown[];
};

// The FORM Score — a high-level read of training performance, progress,
// recovery, and consistency. Not a medical score: a summary that gives the
// brand name a product meaning ("this is what is happening to your form").
export function FormScoreCard({ score, rating, deltaLabel, breakdown }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.eyebrow}>DEIN FORM</Text>

      <View style={styles.top}>
        <ProgressRing
          progress={score / 100}
          size={108}
          strokeWidth={10}
          centerLabel={String(score)}
          centerSub={rating}
          centerLabelStyle={styles.ringScore}
          centerSubStyle={styles.ringRating}
        />
        <View style={styles.deltaRow}>
          <ArrowUp size={14} strokeWidth={iconStrokeWidth} color={colors.green} />
          <Text style={styles.deltaLabel}>{deltaLabel}</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        {breakdown.map((item) => (
          <View key={item.label} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={[styles.rowValue, { color: item.color }]}>{item.value}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${item.value}%`, backgroundColor: item.color }]} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  eyebrow: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fontFamily.medium,
    letterSpacing: 1.2,
  },
  top: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  ringScore: {
    fontSize: 32,
    fontFamily: fontFamily.semibold,
  },
  ringRating: {
    fontSize: 11,
    fontFamily: fontFamily.semibold,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deltaLabel: {
    color: colors.green,
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
  },
  breakdown: {
    gap: spacing.md,
  },
  row: {
    gap: 6,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fontFamily.medium,
  },
  rowValue: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
