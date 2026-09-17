import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { RadioRow } from '@/components/ui/RadioRow';
import { Stepper } from '@/components/ui/Stepper';
import { strings } from '@/lib/strings';
import type { StructureKind, WorkoutSection, WorkoutStructure } from '@/lib/types';
import { defaultStructureForKind } from '@/lib/workoutSections';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { WizardHeader } from './WizardHeader';

const CUSTOM_MAX = 100;

type Props = {
  section: WorkoutSection;
  sectionIndex: number;
  totalSections: number;
  onStructureChange: (structure: WorkoutStructure) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepSectionStructure({ section, onStructureChange, onBack, onContinue }: Props) {
  const structure = section.structure ?? defaultStructureForKind('fixedRounds');

  const selectKind = (kind: StructureKind) => {
    if (structure.kind === kind) return;
    onStructureChange(defaultStructureForKind(kind));
  };

  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.roundsSchemeTitle} subtitle={strings.roundsSchemeSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RadioRow
          label={strings.fixedRoundsLabel}
          selected={structure.kind === 'fixedRounds'}
          onPress={() => selectKind('fixedRounds')}
        >
          {structure.kind === 'fixedRounds' ? (
            <Stepper value={structure.rounds} onChange={(rounds) => onStructureChange({ kind: 'fixedRounds', rounds })} min={1} />
          ) : null}
        </RadioRow>

        <RadioRow
          label={strings.repSchemeLabel}
          hint={structure.kind === 'repScheme' ? strings.repSchemeHint : undefined}
          selected={structure.kind === 'repScheme'}
          onPress={() => selectKind('repScheme')}
        >
          {structure.kind === 'repScheme' ? (
            <Card style={styles.fieldCard}>
              <TextInput
                style={styles.input}
                value={structure.scheme}
                onChangeText={(scheme) => onStructureChange({ kind: 'repScheme', scheme })}
                placeholder={strings.repSchemePlaceholder}
                placeholderTextColor={colors.textTertiary}
              />
            </Card>
          ) : null}
        </RadioRow>

        <RadioRow
          label={strings.timeBasedLabel}
          selected={structure.kind === 'timeBased'}
          onPress={() => selectKind('timeBased')}
        >
          {structure.kind === 'timeBased' ? (
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.label}>{strings.totalTime}</Text>
                <Stepper
                  value={structure.minutes}
                  onChange={(minutes) => onStructureChange({ ...structure, minutes })}
                  min={0}
                  suffix={strings.min}
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.label}> </Text>
                <Stepper
                  value={structure.seconds}
                  onChange={(seconds) => onStructureChange({ ...structure, seconds })}
                  min={0}
                  max={59}
                  step={5}
                  suffix={strings.sec}
                />
              </View>
            </View>
          ) : null}
        </RadioRow>

        <RadioRow
          label={strings.customStructureLabel}
          selected={structure.kind === 'custom'}
          onPress={() => selectKind('custom')}
        >
          {structure.kind === 'custom' ? (
            <Card style={styles.fieldCard}>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={structure.text}
                onChangeText={(text) => onStructureChange({ kind: 'custom', text: text.slice(0, CUSTOM_MAX) })}
                placeholder={strings.customStructurePlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={CUSTOM_MAX}
              />
              <Text style={styles.charCount}>
                {structure.text.length}/{CUSTOM_MAX}
              </Text>
            </Card>
          ) : null}
        </RadioRow>
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
  fieldCard: { gap: 4 },
  input: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold, padding: 0 },
  multiline: { minHeight: 60, textAlignVertical: 'top', fontFamily: fontFamily.regular },
  charCount: { color: colors.textTertiary, fontSize: 11, textAlign: 'right', fontFamily: fontFamily.regular },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  timeField: { flex: 1, gap: 6 },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
