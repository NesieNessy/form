import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconPillSelector } from '@/components/ui/IconPillSelector';
import { RadioRow } from '@/components/ui/RadioRow';
import { strings } from '@/lib/strings';
import type { SectionWorkoutType, StructureKind, WorkoutSection } from '@/lib/types';
import { SECTION_META, defaultStructureForKind } from '@/lib/workoutSections';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';
import { WizardHeader } from './WizardHeader';

const WORKOUT_TYPE_OPTIONS = [
  { key: 'forTime' as const, label: strings.workoutTypeForTime, icon: Icons.timer },
  { key: 'amrap' as const, label: strings.workoutTypeAmrap, icon: Icons.infinity },
  { key: 'emom' as const, label: strings.workoutTypeEmom, icon: Icons.repeat },
  { key: 'tabata' as const, label: strings.workoutTypeTabata, icon: Icons.zap },
  { key: 'strength' as const, label: strings.strength, icon: Icons.dumbbell },
  { key: 'partnerWod' as const, label: strings.workoutTypePartnerWod, icon: Icons.users },
  { key: 'custom' as const, label: strings.workoutTypeCustom, icon: Icons.shuffle },
];

const STRUCTURE_KIND_OPTIONS: { key: StructureKind; label: string }[] = [
  { key: 'fixedRounds', label: strings.structureFixedRounds },
  { key: 'repScheme', label: strings.structureRepScheme },
  { key: 'timeBased', label: strings.structureTimeBased },
  { key: 'custom', label: strings.structureCustom },
];

type Props = {
  section: WorkoutSection;
  sectionIndex: number;
  totalSections: number;
  onWorkoutTypeChange: (t: SectionWorkoutType) => void;
  onStructureChange: (structure: ReturnType<typeof defaultStructureForKind>) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepSectionType({
  section,
  sectionIndex,
  totalSections,
  onWorkoutTypeChange,
  onStructureChange,
  onBack,
  onContinue,
}: Props) {
  const meta = SECTION_META[section.key];
  return (
    <View style={styles.screen}>
      <WizardHeader
        title={strings.configureSectionTitle}
        subtitle={strings.sectionProgress(sectionIndex + 1, totalSections, meta.label)}
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{strings.workoutType}</Text>
        <IconPillSelector
          options={WORKOUT_TYPE_OPTIONS}
          value={section.workoutType ?? 'forTime'}
          onChange={onWorkoutTypeChange}
        />

        <Text style={styles.sectionTitle}>{strings.roundsStructure}</Text>
        {STRUCTURE_KIND_OPTIONS.map((opt) => (
          <RadioRow
            key={opt.key}
            label={opt.label}
            selected={section.structure?.kind === opt.key}
            onPress={() => onStructureChange(defaultStructureForKind(opt.key))}
          />
        ))}
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
  sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginBottom: spacing.sm, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
