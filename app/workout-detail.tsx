import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workout = useWorkoutsStore((s) => s.workouts.find((w) => w.id === id));

  if (!workout) {
    return (
      <View style={styles.screen}>
        <DetailHeader title="Workout" />
        <View style={styles.missing}>
          <Text style={styles.missingText}>This workout couldn't be found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DetailHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <WorkoutSummaryView
          title={workout.title}
          dateLabel={workout.dateLabel}
          intervalsLabel={workout.intervalsLabel}
          exercises={workout.exercises}
          notes={workout.notes}
          bodyData={workout.bodyData}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.regular },
});
