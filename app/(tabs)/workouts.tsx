import { router } from 'expo-router';
import { Dumbbell } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { TabHeader } from '@/components/ui/TabHeader';
import { WorkoutCard } from '@/components/workout/WorkoutCard';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function WorkoutsScreen() {
  const workouts = useWorkoutsStore((s) => s.workouts);

  if (workouts.length === 0) {
    return (
      <View style={styles.screen}>
        <TabHeader />
        <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Dumbbell color={colors.textSecondary} size={28} />
          </View>
          <Text style={styles.title}>No workouts planned yet</Text>
          <Text style={styles.body}>Your training plans will show up here once you create them.</Text>
          <View style={{ height: spacing.md }} />
          <GradientButton label="New Workout" onPress={() => router.push('/workout-new')} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Workouts</Text>
        <Text style={styles.pageSubtitle}>Your training plans, all in one place.</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <GradientButton label="New Workout" onPress={() => router.push('/workout-new')} />
        {workouts.map((w) => (
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
