import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { formatDateLabel, formatTimeLabel } from '@/lib/date';
import { strings } from '@/lib/strings';
import type { Exercise, WorkoutSection } from '@/lib/types';
import { formatExerciseTarget, formatSectionHeadline } from '@/lib/workoutFormat';
import { SECTION_META } from '@/lib/workoutSections';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  title: string;
  dateTimeMs: number;
  sections: WorkoutSection[];
  notes?: string;
  durationLabel?: string;
  totalVolumeLabel?: string;
};

function ExerciseLine({ exercise, index }: { exercise: Exercise; index: number }) {
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseBullet}>
        <Icons.dumbbell size={13} color={colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exerciseName}>{exercise.name || strings.exerciseNumbered(index + 1)}</Text>
        <Text style={styles.exerciseDetail}>{formatExerciseTarget(exercise)}</Text>
      </View>
    </View>
  );
}

function SectionCard({ section }: { section: WorkoutSection }) {
  if (section.exercises.length === 0 && !section.workoutType) return null;
  const meta = SECTION_META[section.key];
  const Icon = meta.icon;
  const headline = formatSectionHeadline(section);
  const isWod = section.key === 'wod';

  const body = (
    <Card style={[styles.sectionCard, isWod && styles.sectionCardWod]}>
      <View style={styles.sectionHeader}>
        <Icon size={15} color={isWod ? colors.text : colors.textSecondary} />
        <Text style={styles.sectionTitle}>{meta.label}</Text>
      </View>
      {headline ? <Text style={styles.sectionHeadline}>{headline}</Text> : null}
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {section.exercises.map((ex, i) => (
          <ExerciseLine key={ex.id} exercise={ex} index={i} />
        ))}
      </View>
    </Card>
  );

  if (isWod) {
    return (
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wodBorder}>
        {body}
      </LinearGradient>
    );
  }
  return body;
}

export function WorkoutSummaryView({ title, dateTimeMs, sections, notes, durationLabel, totalVolumeLabel }: Props) {
  const date = new Date(dateTimeMs);
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={styles.title}>{title || strings.untitledWorkout}</Text>
        <Text style={styles.date}>
          {formatDateLabel(date)} · {formatTimeLabel(date)}
        </Text>
      </Card>

      {sections.map((section) => (
        <SectionCard key={section.key} section={section} />
      ))}

      {durationLabel || totalVolumeLabel ? (
        <Card style={styles.chipRow}>
          {durationLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{strings.duration}</Text>
              <Text style={styles.chipValue}>{durationLabel}</Text>
            </View>
          ) : null}
          {totalVolumeLabel ? (
            <View style={styles.chip}>
              <Text style={styles.chipLabel}>{strings.totalVolume}</Text>
              <Text style={styles.chipValue}>{totalVolumeLabel}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {notes ? (
        <Card>
          <Text style={styles.sectionTitle}>{strings.notes}</Text>
          <Text style={styles.notes}>{notes}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontFamily: fontFamily.bold },
  date: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
  wodBorder: { borderRadius: radius.card + 1.5, padding: 1.5 },
  sectionCard: { gap: 0 },
  sectionCardWod: { borderWidth: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold, marginBottom: 4 },
  sectionHeadline: { color: colors.textTertiary, fontSize: 12.5, marginTop: 4, fontFamily: fontFamily.medium },
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
  chip: { gap: 2 },
  chipLabel: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.medium },
  chipValue: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  notes: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
});
