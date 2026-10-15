import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Sensitive } from '@/components/ui/Sensitive';
import { progressText } from '@/lib/goals/describe';
import { entriesOn, totals } from '@/lib/nutrition/engine';
import { rangeText, totalText } from '@/lib/nutrition/format';
import { targetsForDay, trainingDay } from '@/lib/nutrition/targets';
import { insightFor } from '@/lib/recovery/state';
import { strings, timeLocale } from '@/lib/strings';
import type { ScheduleItem } from '@/lib/useWorkouts';
import { getWorkoutData, useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing, tabular } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function Header({ icon: Icon, title, onPress }: { icon: typeof Icons.heart; title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.header} onPress={onPress} accessibilityRole="link" accessibilityLabel={title}>
      <Icon size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
      <Text style={styles.title}>{title}</Text>
      <Icons.chevronRight size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
    </TouchableOpacity>
  );
}

/** What is planned today, in time order. */
export function TodayPlanCard({ items }: { items: ScheduleItem[] }) {
  return (
    <Card style={styles.card}>
      <Header icon={Icons.calendar} title={strings.todaysPlan} onPress={() => router.push('/workouts')} />
      {items.length === 0 ? <Text style={styles.body}>{strings.nothingPlannedThisDay}</Text> : null}
      {items.map((i) => (
        <TouchableOpacity key={i.entry.id} style={styles.line} onPress={() => router.push(`/workout-detail?id=${i.entry.id}`)} accessibilityRole="link">
          <Text style={styles.time}>{new Date(i.entry.scheduledAt).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={[styles.body, { flex: 1 }]} numberOfLines={1}>
            {i.version.content.title}
          </Text>
          <Text style={styles.meta}>{i.entry.status === 'completed' ? strings.completed : i.entry.status === 'skipped' ? strings.didNotDo : i.openSession ? strings.inProgress : strings.planned}</Text>
        </TouchableOpacity>
      ))}
    </Card>
  );
}

const RECOVERY_TEXT: Record<string, string> = {
  steady: strings.statusSteady,
  attention: strings.statusAttention,
  conflicting: strings.statusConflicting,
  limited_data: strings.statusLimited,
  unwell: strings.statusUnwell,
};

/** Today's recovery picture in one sentence; the details are on the Recovery screen. */
export function RecoveryCard() {
  const observations = useWorkoutsStore((s) => s.observations);
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const sessions = useWorkoutsStore((s) => s.sessions);
  const insight = useMemo(() => insightFor(getWorkoutData(), Date.now()), [observations, scheduled, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card style={styles.card}>
      <Header icon={Icons.heart} title={strings.recoveryTitle} onPress={() => router.push('/recovery')} />
      <Text style={styles.body}>{RECOVERY_TEXT[insight.status]}</Text>
    </Card>
  );
}

/** Today's energy and protein against the day's targets, when anything is logged. */
export function FuelCard() {
  const foodLog = useWorkoutsStore((s) => s.foodLog);
  const profile = useWorkoutsStore((s) => s.profile);
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const versions = useWorkoutsStore((s) => s.versions);
  const date = ymd(new Date());
  const entries = useMemo(() => entriesOn(Object.values(foodLog), date), [foodLog, date]);
  const day = useMemo(() => totals(entries), [entries]);
  const training = trainingDay(date, Object.values(scheduled), versions, profile.minutesPerSession);
  const targets = targetsForDay(profile.nutritionTargets, training.dayType);
  const keys = (['energy_kcal', 'protein_g'] as const).filter((k) => !(profile.hideEnergy && k === 'energy_kcal'));
  return (
    <Card style={styles.card}>
      <Header icon={Icons.flame} title={strings.fuelToday} onPress={() => router.push('/nutrition')} />
      {entries.length === 0 ? (
        <Text style={styles.body}>{strings.nothingLogged}</Text>
      ) : (
        keys.map((k) => {
          const target = rangeText(targets[k as keyof typeof targets], k === 'energy_kcal' ? 'kcal' : 'g');
          return (
            <View key={k} style={styles.line}>
              <Text style={[styles.body, { flex: 1 }]}>{k === 'energy_kcal' ? strings.energy : strings.protein}</Text>
              <Sensitive style={styles.value}>{totalText(k, day.nutrients[k], day.entries)}</Sensitive>
              {target ? <Text style={styles.meta}>{`/ ${target}`}</Text> : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

/** The goal with the nearest date, and how it stands. */
export function GoalCard() {
  const goals = useWorkoutsStore((s) => s.goals);
  const next = Object.values(goals)
    .filter((g) => !g.deletedAt && g.status === 'active')
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  if (!next) return null;
  const pct = next.progress?.fraction !== undefined ? Math.round(Math.min(1, Math.max(0, next.progress.fraction)) * 100) : undefined;
  return (
    <Card style={styles.card}>
      <Header icon={Icons.target} title={next.title} onPress={() => router.push({ pathname: '/goal', params: { id: next.id } })} />
      {pct !== undefined ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      ) : null}
      {progressText(next) ? <Text style={styles.body}>{progressText(next)}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  title: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  time: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold, ...tabular },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  value: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, ...tabular },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.teal },
});
