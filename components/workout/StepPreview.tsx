import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { strings } from '@/lib/strings';
import type { Exercise, WorkoutBodyData } from '@/lib/types';
import { colors, spacing } from '@/theme/colors';
import { WizardHeader } from './WizardHeader';
import { WorkoutSummaryView } from './WorkoutSummaryView';

type Props = {
  title: string;
  dateLabel: string;
  intervalsLabel: string;
  exercises: Exercise[];
  notes: string;
  bodyData: WorkoutBodyData;
  onBack: () => void;
  onSave: () => void;
};

export function StepPreview({ title, dateLabel, intervalsLabel, exercises, notes, bodyData, onBack, onSave }: Props) {
  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.workoutPreviewTitle} subtitle={strings.workoutPreviewSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <WorkoutSummaryView
          title={title}
          dateLabel={dateLabel}
          intervalsLabel={intervalsLabel}
          exercises={exercises}
          notes={notes}
          bodyData={bodyData}
        />
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label={strings.saveWorkout} onPress={onSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
