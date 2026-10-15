import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FuelCard, GoalCard, RecoveryCard, TodayPlanCard } from '@/components/today/TodayCards';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { StatCard } from '@/components/ui/StatCard';
import { TabHeader } from '@/components/ui/TabHeader';
import { WeekStrip } from '@/components/ui/WeekStrip';
import { ProgressRing } from '@/components/charts/ProgressRing';
import { isSameDay } from '@/lib/date';
import { useLayout } from '@/lib/useLayout';
import { readPreference } from '@/lib/preferences';
import { locale, strings } from '@/lib/strings';
import { useTrainingStats } from '@/lib/useTrainingStats';
import { useScheduleItems } from '@/lib/useWorkouts';
import { enduranceSeries } from '@/lib/workout/analytics';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Stat = { label: string; value: string; delta: string; positive: boolean; direction: 'up' | 'down' };

function greetingFor(hour: number): string {
  if (hour < 12) return strings.goodMorning;
  if (hour < 18) return strings.goodAfternoon;
  return strings.goodEvening;
}

/**
 * Today (docs/concepts/11-frontend-ux-ui-architecture.md, 6.1): the next
 * action first, then today's plan, recovery, food and goal, then the week.
 * Every number comes from the athlete's own records.
 */
export default function TodayScreen() {
  const stats = useTrainingStats('all');
  const { wide } = useLayout();
  const items = useScheduleItems();
  const weeklyTarget = useWorkoutsStore((s) => s.profile.weeklySessionTarget);
  const observations = useWorkoutsStore((s) => s.observations);
  const episodes = useWorkoutsStore((s) => s.episodes);
  const goals = useWorkoutsStore((s) => s.goals);
  const hasData = useWorkoutsStore((s) => Object.keys(s.workouts).length > 0 || Object.keys(s.sessions).length > 0 || s.profile.sports.length > 0);

  // First run on a device with nothing in it: the short setup comes first.
  useEffect(() => {
    if (!hasData && readPreference('onboarded') !== 'done') router.replace('/welcome');
  }, [hasData]);

  const today = new Date(stats.now);
  const todays = items
    .filter((i) => isSameDay(new Date(i.entry.scheduledAt), today) && i.version.status === 'published')
    .sort((a, b) => a.entry.scheduledAt - b.entry.scheduledAt);
  // Today's next thing to do: a session already under way, else the earliest one still planned.
  const upNext = todays.find((i) => i.openSession) ?? todays.find((i) => i.entry.status === 'planned');

  // Shortcuts that fit today: a check-in until one is made, rehab while a case is open, goals while one is active.
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const checkedIn = Object.values(observations).some((o) => !o.deletedAt && o.localDate === ymd && o.metric.startsWith('subjective_'));
  const openCase = Object.values(episodes).some((e) => !e.deletedAt && e.status !== 'resolved');
  const activeGoal = Object.values(goals).some((g) => !g.deletedAt && g.status === 'active');
  const shortcuts = [
    !checkedIn && { key: 'checkin', label: strings.shortcutCheckIn, icon: Icons.heart, route: '/recovery' },
    { key: 'food', label: strings.shortcutLogFood, icon: Icons.flame, route: '/nutrition' },
    openCase && { key: 'rehab', label: strings.shortcutRehab, icon: Icons.personStanding, route: '/rehab' },
    activeGoal && { key: 'goals', label: strings.shortcutGoals, icon: Icons.target, route: '/goals-forecast' },
    { key: 'ask', label: strings.shortcutAsk, icon: Icons.sparkles, route: '/chat' },
  ].filter(Boolean) as { key: string; label: string; icon: typeof Icons.heart; route: string }[];

  // Only figures the athlete's own sessions support; no tile is shown without data.
  const pace = enduranceSeries(stats.efforts, 'all', 'all', stats.now);
  const progress = [
    stats.strengthPct !== undefined && {
      label: strings.strength,
      value: `${stats.strengthPct >= 0 ? '+' : ''}${stats.strengthPct}%`,
      delta: strings.vsStart,
      positive: stats.strengthPct >= 0,
      direction: stats.strengthPct >= 0 ? 'up' : 'down',
    },
    pace?.deltaPct !== undefined && {
      label: strings.endurance,
      // A lower pace is an improvement, so the sign is flipped for display.
      value: `${pace.deltaPct <= 0 ? '+' : '-'}${Math.abs(pace.deltaPct)}%`,
      delta: strings.paceVsStart,
      positive: pace.deltaPct <= 0,
      direction: pace.deltaPct <= 0 ? 'up' : 'down',
    },
  ].filter(Boolean) as Stat[];

  return (
    <View style={styles.screen}>
      <TabHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{greetingFor(today.getHours())}</Text>
        <Text style={styles.date}>{today.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>

        <GradientButton
          label={upNext?.openSession ? strings.resumeWorkout : strings.startWorkout}
          onPress={() => (upNext ? router.push(`/workout-detail?id=${upNext.entry.id}`) : router.push('/workout-new'))}
          style={wide ? styles.wideButton : undefined}
        />

        <Text style={styles.sectionTitle}>{strings.shortcuts}</Text>
        <View style={styles.shortcuts}>
          {shortcuts.map((s) => (
            <TouchableOpacity key={s.key} style={styles.shortcut} onPress={() => router.push(s.route as never)} accessibilityRole="link" accessibilityLabel={s.label}>
              <s.icon size={16} color={colors.action} strokeWidth={iconStrokeWidth} />
              <Text style={styles.shortcutText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={wide ? styles.columns : styles.cards}>
          <View style={wide ? styles.column : styles.stack}>
            <TodayPlanCard items={todays} />
            <RecoveryCard />
          </View>
          <View style={wide ? styles.column : styles.stack}>
          <FuelCard />
          <GoalCard />
          <Card style={styles.goalCard}>
            <View style={styles.goalRow}>
              <ProgressRing progress={Math.min(1, stats.week.completedCount / weeklyTarget)} centerLabel={`${stats.week.completedCount}/${weeklyTarget}`} centerSub={strings.workouts} />
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
          </View>
        </View>

        {progress.length ? (
          <>
            <Text style={styles.sectionTitle}>{strings.yourProgress}</Text>
            <View style={styles.statsGrid}>
              {progress.map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} delta={s.delta} positive={s.positive} direction={s.direction} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  greeting: { color: colors.text, fontSize: 24, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: spacing.lg, fontFamily: fontFamily.regular },
  cards: { gap: spacing.md, marginTop: spacing.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg, marginTop: spacing.lg },
  column: { flex: 1, minWidth: 0, gap: spacing.md },
  stack: { gap: spacing.md },
  wideButton: { alignSelf: 'flex-start', minWidth: 360 },
  goalCard: { gap: spacing.lg },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  goalTextWrap: { flex: 1 },
  goalLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
  goalValue: { color: colors.text, fontSize: 20, fontFamily: fontFamily.bold, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 17, fontFamily: fontFamily.bold, marginTop: spacing.xl, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  shortcutText: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
});
