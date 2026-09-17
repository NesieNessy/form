import { Plus, Search } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { searchExerciseLibrary, type ExerciseLibraryEntry } from '@/lib/exerciseLibrary';
import { strings } from '@/lib/strings';
import type { Exercise, WorkoutSection } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { ExerciseRow } from './ExerciseRow';
import { WizardHeader } from './WizardHeader';

type Props = {
  section: WorkoutSection;
  sectionIndex: number;
  totalSections: number;
  onExercisesChange: (exercises: Exercise[]) => void;
  onEditExercise: (exerciseId: string) => void;
  onAddExercise: () => void;
  onQuickAdd: (entry: ExerciseLibraryEntry) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepSectionExercises({
  section,
  onExercisesChange,
  onEditExercise,
  onAddExercise,
  onQuickAdd,
  onBack,
  onContinue,
}: Props) {
  const [query, setQuery] = useState('');
  const filtered = searchExerciseLibrary(query);

  const moveExercise = (index: number, delta: number) => {
    const next = [...section.exercises];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onExercisesChange(next);
  };
  const removeExercise = (index: number) => {
    onExercisesChange(section.exercises.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.addExercisesTitle} subtitle={strings.addExercisesSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {section.exercises.length > 0 ? (
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            {section.exercises.map((exercise, index) => (
              <ExerciseRow
                key={exercise.id}
                index={index}
                exercise={exercise}
                onPress={() => onEditExercise(exercise.id)}
                onMoveUp={index > 0 ? () => moveExercise(index, -1) : undefined}
                onMoveDown={index < section.exercises.length - 1 ? () => moveExercise(index, 1) : undefined}
                onRemove={() => removeExercise(index)}
              />
            ))}
          </View>
        ) : null}

        <GradientButton
          label={strings.addExercise}
          variant="secondary"
          icon={<Plus size={16} color={colors.text} strokeWidth={iconStrokeWidth} />}
          style={styles.addBtn}
          onPress={onAddExercise}
        />

        <Text style={styles.libraryTitle}>{strings.exerciseLibrary}</Text>
        <Card style={styles.searchCard}>
          <Search size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={strings.searchExercisesPlaceholder}
            placeholderTextColor={colors.textTertiary}
          />
        </Card>

        <View style={{ gap: spacing.xs }}>
          {filtered.map((entry) => (
            <TouchableOpacity
              key={entry.name}
              style={styles.libraryRow}
              activeOpacity={0.7}
              onPress={() => onQuickAdd(entry)}
            >
              <Text style={styles.libraryName}>{entry.name}</Text>
              <View style={styles.libraryAddBtn}>
                <Plus size={15} color={colors.blue} strokeWidth={iconStrokeWidth} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label={strings.continue} onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  addBtn: { marginBottom: spacing.lg },
  libraryTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginBottom: spacing.sm },
  searchCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontFamily: fontFamily.regular, padding: 0 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  libraryName: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  libraryAddBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
