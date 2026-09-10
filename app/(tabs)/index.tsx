import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { FormScoreCard } from '@/components/ui/FormScoreCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { StatCard } from '@/components/ui/StatCard';
import { TabHeader } from '@/components/ui/TabHeader';
import { WeekStrip } from '@/components/ui/WeekStrip';
import { ProgressRing } from '@/components/charts/ProgressRing';
import { formScore, homeSummary, weekStrip } from '@/lib/mockData';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function HomeScreen() {
  const { weeklyGoal } = homeSummary;

  return (
    <View style={styles.screen}>
      <TabHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{homeSummary.greeting}</Text>
        <Text style={styles.subGreeting}>{homeSummary.subGreeting}</Text>

        <FormScoreCard
          score={formScore.score}
          rating={formScore.rating}
          deltaLabel={formScore.deltaLabel}
          breakdown={formScore.breakdown}
        />
        <View style={{ height: spacing.cardGap }} />

        <Card style={styles.goalCard}>
          <View style={styles.goalRow}>
            <ProgressRing
              progress={weeklyGoal.current / weeklyGoal.target}
              centerLabel={`${weeklyGoal.current}/${weeklyGoal.target}`}
              centerSub="Workouts"
            />
            <View style={styles.goalTextWrap}>
              <Text style={styles.goalLabel}>Weekly Goal</Text>
              <Text style={styles.goalValue}>
                {weeklyGoal.current} / {weeklyGoal.target} Workouts
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <WeekStrip days={weekStrip} />
        </Card>

        <View style={{ height: spacing.lg }} />
        <GradientButton label="Start Workout" />

        <Text style={styles.sectionTitle}>Your Progress</Text>
        <View style={styles.statsGrid}>
          {homeSummary.stats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              positive={s.positive}
              direction={s.delta.includes('-') ? 'down' : 'up'}
            />
          ))}
        </View>

        <Card style={styles.quoteCard}>
          <Text style={styles.quote}>"{homeSummary.quote}"</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.xxl,
  },
  greeting: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700', fontFamily: fontFamily.bold,
    marginTop: spacing.sm,
  },
  subGreeting: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  goalCard: {
    gap: spacing.lg,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  goalTextWrap: {
    flex: 1,
  },
  goalLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600', fontFamily: fontFamily.semibold,
  },
  goalValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700', fontFamily: fontFamily.bold,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700', fontFamily: fontFamily.bold,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quoteCard: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  quote: {
    color: colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
});
