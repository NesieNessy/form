import { Clock, Dumbbell, Flame, Heart, Percent } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import type { Exercise, WorkoutBodyData } from '@/lib/types';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  title: string;
  dateLabel: string;
  intervalsLabel?: string;
  exercises: Exercise[];
  notes?: string;
  bodyData?: WorkoutBodyData;
};

const BODY_DATA_CHIPS: { key: keyof WorkoutBodyData; icon: typeof Heart; color: string }[] = [
  { key: 'avgHeartRate', icon: Heart, color: colors.red },
  { key: 'calories', icon: Flame, color: colors.orange },
  { key: 'duration', icon: Clock, color: colors.blue },
  { key: 'zonesPct', icon: Percent, color: colors.teal },
];

export function WorkoutSummaryView({ title, dateLabel, intervalsLabel, exercises, notes, bodyData }: Props) {
  const filledChips = BODY_DATA_CHIPS.filter((c) => bodyData?.[c.key]);

  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={styles.title}>{title || 'Untitled Workout'}</Text>
        <Text style={styles.date}>{dateLabel}</Text>
        {intervalsLabel ? <Text style={styles.intervals}>{intervalsLabel}</Text> : null}
      </Card>

      {exercises.length > 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {exercises.map((ex, i) => (
            <View key={ex.id} style={styles.exerciseRow}>
              <View style={styles.exerciseBullet}>
                <Dumbbell size={13} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{ex.name || `Exercise ${i + 1}`}</Text>
                {ex.detail ? <Text style={styles.exerciseDetail}>{ex.detail}</Text> : null}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {filledChips.length > 0 ? (
        <Card style={styles.chipRow}>
          {filledChips.map((c) => (
            <View key={c.key} style={styles.chip}>
              <c.icon size={14} color={c.color} />
              <Text style={styles.chipValue}>{bodyData?.[c.key]}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {notes ? (
        <Card>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{notes}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontFamily: fontFamily.bold },
  date: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
  intervals: { color: colors.textTertiary, fontSize: 12.5, marginTop: 6, fontFamily: fontFamily.medium },
  sectionTitle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold, marginBottom: 4 },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  exerciseBullet: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  exerciseName: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
  exerciseDetail: { color: colors.textTertiary, fontSize: 12, marginTop: 1, fontFamily: fontFamily.regular },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipValue: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  notes: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
});
