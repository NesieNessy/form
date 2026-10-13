import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { FormScoreCard } from '@/components/ui/FormScoreCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { SampleBadge } from '@/components/ui/SampleBadge';
import { StatCard } from '@/components/ui/StatCard';
import { TabHeader } from '@/components/ui/TabHeader';
import { WeekStrip } from '@/components/ui/WeekStrip';
import { ProgressRing } from '@/components/charts/ProgressRing';
import { isSameDay } from '@/lib/date';
import { formScore, homeSummary } from '@/lib/mockData';
import { strings } from '@/lib/strings';
import { useTrainingStats } from '@/lib/useTrainingStats';
import { useScheduleItems } from '@/lib/useWorkouts';
import { enduranceSeries } from '@/lib/workout/analytics';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

type Stat = { label: string; value: string; delta: string; positive: boolean; direction: 'up' | 'down'; sample: boolean };

function greetingFor(hour: number): string {
  if (hour < 12) return strings.goodMorning;
  if (hour < 18) return strings.goodAfternoon;
  return strings.goodEvening;
}

export default function HomeScreen() {
  const stats = useTrainingStats('all');
  const items = useScheduleItems();
  const weeklyTarget = useWorkoutsStore((s) => s.profile.weeklySessionTarget);

  const today = new Date(stats.now);
  // Today's next thing to do: a session already under way, else the earliest one still planned.
  const todays = items.filter((i) => isSameDay(new Date(i.entry.scheduledAt), today) && i.version.status === 'published');
  const upNext = todays.find((i) => i.openSession) ?? [...todays].reverse().find((i) => i.entry.status === 'planned');

  // Body measurements are not captured yet, so those two tiles stay sample values and say so.
  const [sampleWeight, sampleBodyFat, sampleStrength, sampleEndurance] = homeSummary.stats.map(
    (s): Stat => ({ ...s, direction: s.delta.includes('-') ? 'down' : 'up', sample: true })
  );
  const pace = enduranceSeries(stats.efforts, 'all', 'all', stats.now);
  const progress: Stat[] = [
    sampleWeight,
    sampleBodyFat,
    stats.lifts.length === 0
      ? sampleStrength
      : stats.strengthPct === undefined
        ? { label: strings.strength, value: strings.notAvailable, delta: strings.noDataYet, positive: true, direction: 'up', sample: false }
        : {
            label: strings.strength,
            value: `${stats.strengthPct >= 0 ? '+' : ''}${stats.strengthPct}%`,
            delta: strings.vsStart,
            positive: stats.strengthPct >= 0,
            direction: stats.strengthPct >= 0 ? 'up' : 'down',
            sample: false,
          },
    !pace
      ? sampleEndurance
      : pace.deltaPct === undefined
        ? { label: strings.endurance, value: strings.notAvailable, delta: strings.noDataYet, positive: true, direction: 'up', sample: false }
        : {
            label: strings.endurance,
            // A lower pace is an improvement, so the sign is flipped for display.
            value: `${pace.deltaPct <= 0 ? '+' : '-'}${Math.abs(pace.deltaPct)}%`,
            delta: strings.paceVsStart,
            positive: pace.deltaPct <= 0,
            direction: pace.deltaPct <= 0 ? 'up' : 'down',
            sample: false,
          },
  ];

  return (
    <View style={styles.screen}>
      <TabHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{greetingFor(today.getHours())}</Text>
        <Text style={styles.subGreeting}>{homeSummary.subGreeting}</Text>

        <SampleBadge explain style={{ marginBottom: spacing.sm }} />
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
              progress={Math.min(1, stats.week.completedCount / weeklyTarget)}
              centerLabel={`${stats.week.completedCount}/${weeklyTarget}`}
              centerSub={strings.workouts}
            />
            <View style={styles.goalTextWrap}>
              <Text style={styles.goalLabel}>{strings.weeklyGoal}</Text>
              <Text style={styles.goalValue}>
                {stats.week.completedCount} / {weeklyTarget} {strings.workouts}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <WeekStrip days={stats.week.days} />
        </Card>

        <View style={{ height: spacing.lg }} />
        <GradientButton
          label={upNext?.openSession ? strings.resumeWorkout : strings.startWorkout}
          onPress={() => (upNext ? router.push(`/workout-detail?id=${upNext.entry.id}`) : router.push('/workout-new'))}
        />

        <Text style={styles.sectionTitle}>{strings.yourProgress}</Text>
        <View style={styles.statsGrid}>
          {progress.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              positive={s.positive}
              direction={s.direction}
              sample={s.sample}
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
