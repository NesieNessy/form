import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { strings } from '@/lib/strings';
import type { WorkoutContent } from '@/lib/workout/model';
import type { ValidationResult } from '@/lib/workout/validate';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { ValidationIssues } from './ValidationIssues';
import { WizardHeader } from './WizardHeader';
import { WorkoutSummaryView } from './WorkoutSummaryView';

type Props = {
  content: WorkoutContent;
  validation: ValidationResult;
  dateTimeMs: number;
  onBack: () => void;
  onSave: () => void;
};

export function StepWorkoutPreview({ content, validation, dateTimeMs, onBack, onSave }: Props) {
  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.workoutPreviewTitle} subtitle={strings.workoutPreviewSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ValidationIssues result={validation} />
        <WorkoutSummaryView content={content} dateTimeMs={dateTimeMs} />
      </ScrollView>
      <View style={styles.footer}>
        {validation.valid ? (
          <GradientButton label={strings.saveWorkout} onPress={onSave} />
        ) : (
          <Text style={styles.blocked}>{strings.cannotSaveYet}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  blocked: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, fontFamily: fontFamily.regular },
});
