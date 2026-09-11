import { router } from 'expo-router';
import { ChevronRight, Dumbbell } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import type { Workout } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';

export function WorkoutCard({ workout }: { workout: Workout }) {
  const exerciseCount = workout.exercises.length;
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={() => router.push(`/workout-detail?id=${workout.id}`)}>
      <Card style={styles.row}>
        <View style={styles.iconWrap}>
          <Dumbbell size={20} color={colors.blue} strokeWidth={iconStrokeWidth} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{workout.title}</Text>
          <Text style={styles.subtitle}>
            {workout.dateLabel}
            {exerciseCount > 0 ? ` · ${exerciseCount} ${exerciseCount === 1 ? strings.exercise : strings.exercisePlural}` : ''}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textTertiary} />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: `${colors.blue}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  subtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
});
