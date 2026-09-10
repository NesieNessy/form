import { Calendar, Plus, Trash2 } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import type { Exercise } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { FieldCard } from './FieldCard';
import { WizardHeader } from './WizardHeader';

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  dateLabel: string;
  intervalsLabel: string;
  onIntervalsChange: (v: string) => void;
  exercises: Exercise[];
  onExercisesChange: (exercises: Exercise[]) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

let exerciseSeq = 0;
function nextExerciseId() {
  exerciseSeq += 1;
  return `draft-ex-${Date.now()}-${exerciseSeq}`;
}

export function StepEditWorkout({
  title,
  onTitleChange,
  dateLabel,
  intervalsLabel,
  onIntervalsChange,
  exercises,
  onExercisesChange,
  notes,
  onNotesChange,
  onBack,
  onContinue,
}: Props) {
  const updateExercise = (id: string, patch: Partial<Exercise>) => {
    onExercisesChange(exercises.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)));
  };
  const removeExercise = (id: string) => {
    onExercisesChange(exercises.filter((ex) => ex.id !== id));
  };
  const addExercise = () => {
    onExercisesChange([...exercises, { id: nextExerciseId(), name: '' }]);
  };

  return (
    <View style={styles.screen}>
      <WizardHeader title="Edit Workout" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FieldCard label="Title" value={title} onChangeText={onTitleChange} placeholder="e.g. Squat Snatch" />

        <Card style={styles.dateCard}>
          <Calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.dateValue}>{dateLabel}</Text>
          </View>
        </Card>

        <FieldCard
          label="Intervals"
          value={intervalsLabel}
          onChangeText={onIntervalsChange}
          placeholder="e.g. 5 Rounds: 2:00 on / 1:00 off"
        />

        <Text style={styles.sectionTitle}>Exercises</Text>
        <View style={{ gap: spacing.sm }}>
          {exercises.map((ex) => (
            <Card key={ex.id} style={styles.exerciseCard}>
              <View style={styles.exerciseRow}>
                <TextInput
                  style={styles.exerciseName}
                  value={ex.name}
                  onChangeText={(v) => updateExercise(ex.id, { name: v })}
                  placeholder="Exercise name"
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={8}>
                  <Trash2 size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.exerciseDetail}
                value={ex.detail ?? ''}
                onChangeText={(v) => updateExercise(ex.id, { detail: v })}
                placeholder="Detail (optional)"
                placeholderTextColor={colors.textTertiary}
              />
            </Card>
          ))}
        </View>
        <TouchableOpacity style={styles.addRow} activeOpacity={0.7} onPress={addExercise}>
          <Plus size={16} color={colors.blue} strokeWidth={iconStrokeWidth} />
          <Text style={styles.addLabel}>Add Exercise</Text>
        </TouchableOpacity>

        <Card style={styles.notesCard}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={onNotesChange}
            placeholder="Anything else worth remembering about this workout"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  dateValue: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginTop: spacing.sm, marginBottom: spacing.sm },
  exerciseCard: { gap: 6 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { flex: 1, color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold, padding: 0 },
  exerciseDetail: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.regular, padding: 0 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: spacing.lg },
  addLabel: { color: colors.blue, fontSize: 14, fontFamily: fontFamily.semibold },
  notesCard: { gap: 6 },
  notesInput: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular, padding: 0, minHeight: 60, textAlignVertical: 'top' },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
