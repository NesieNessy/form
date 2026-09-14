import { Plus, Trash2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import type { Exercise } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';

let exerciseSeq = 0;
function nextExerciseId() {
  exerciseSeq += 1;
  return `draft-ex-${Date.now()}-${exerciseSeq}`;
}

type Props = {
  exercises: Exercise[];
  onChange: (exercises: Exercise[]) => void;
  addLabel: string;
};

export function ExerciseListEditor({ exercises, onChange, addLabel }: Props) {
  const updateExercise = (id: string, patch: Partial<Exercise>) => {
    onChange(exercises.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)));
  };
  const removeExercise = (id: string) => {
    onChange(exercises.filter((ex) => ex.id !== id));
  };
  const addExercise = () => {
    onChange([...exercises, { id: nextExerciseId(), name: '' }]);
  };

  return (
    <View>
      <View style={{ gap: spacing.sm }}>
        {exercises.map((ex) => (
          <Card key={ex.id} style={styles.exerciseCard}>
            <View style={styles.exerciseRow}>
              <TextInput
                style={styles.exerciseName}
                value={ex.name}
                onChangeText={(v) => updateExercise(ex.id, { name: v })}
                placeholder={strings.exerciseNamePlaceholder}
                placeholderTextColor={colors.textTertiary}
              />
              <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={8}>
                <Trash2 size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaField}>
                <Text style={styles.metaLabel}>{strings.repsLabel}</Text>
                <TextInput
                  style={styles.metaInput}
                  value={ex.reps ?? ''}
                  onChangeText={(v) => updateExercise(ex.id, { reps: v })}
                  placeholder={strings.repsPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaLabel}>{strings.loadLabel}</Text>
                <TextInput
                  style={styles.metaInput}
                  value={ex.load ?? ''}
                  onChangeText={(v) => updateExercise(ex.id, { load: v })}
                  placeholder={strings.loadPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={styles.metaField}>
                <Text style={styles.metaLabel}>{strings.measureLabel}</Text>
                <TextInput
                  style={styles.metaInput}
                  value={ex.measure ?? ''}
                  onChangeText={(v) => updateExercise(ex.id, { measure: v })}
                  placeholder={strings.measurePlaceholder}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>
          </Card>
        ))}
      </View>
      <TouchableOpacity style={styles.addRow} activeOpacity={0.7} onPress={addExercise}>
        <Plus size={16} color={colors.blue} strokeWidth={iconStrokeWidth} />
        <Text style={styles.addLabel}>{addLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseCard: { gap: 8 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseName: { flex: 1, color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold, padding: 0 },
  metaRow: { flexDirection: 'row', gap: spacing.sm },
  metaField: { flex: 1, gap: 2 },
  metaLabel: { color: colors.textTertiary, fontSize: 10.5, fontFamily: fontFamily.medium },
  metaInput: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.regular, padding: 0 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, marginBottom: spacing.lg },
  addLabel: { color: colors.blue, fontSize: 14, fontFamily: fontFamily.semibold },
});
