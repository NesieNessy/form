import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { TabHeader } from '@/components/ui/TabHeader';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

export default function WorkoutsScreen() {
  const workouts = useWorkoutsStore((s) => s.workouts);
  const sortedWorkouts = useMemo(
    () => [...workouts].sort((a, b) => b.dateTimeMs - a.dateTimeMs),
    [workouts]
  );

  if (workouts.length === 0) {
    return (
      <View style={styles.screen}>
        <TabHeader />
        <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Icons.dumbbell color={colors.textSecondary} size={28} />
          </View>
          <Text style={styles.title}>{strings.noWorkoutsPlannedYet}</Text>
          <Text style={styles.body}>{strings.workoutsEmptyBody}</Text>
          <View style={{ height: spacing.md }} />
          <GradientButton
            label={strings.newWorkout}
            onPress={() => router.push('/workout-new')}
            style={styles.newWorkoutButton}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>{strings.workouts}</Text>
        <Text style={styles.pageSubtitle}>{strings.workoutsListSubtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <GradientButton label={strings.newWorkout} onPress={() => router.push('/workout-new')} />
        {sortedWorkouts.map((w) => (
          <WorkoutCard key={w.id} workout={w} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: spacing.screenX, marginBottom: spacing.lg },
  pageTitle: { color: colors.text, fontSize: 22, fontFamily: fontFamily.bold },
  pageSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, fontFamily: fontFamily.regular },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  newWorkoutButton: {
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
