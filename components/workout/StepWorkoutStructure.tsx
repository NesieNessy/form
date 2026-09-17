import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { strings } from '@/lib/strings';
import type { WorkoutSection } from '@/lib/types';
import { SECTION_KEYS_IN_DEFAULT_ORDER, SECTION_META } from '@/lib/workoutSections';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';
import { WizardHeader } from './WizardHeader';

type Props = {
  sections: WorkoutSection[];
  onSectionsChange: (sections: WorkoutSection[]) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepWorkoutStructure({ sections, onSectionsChange, onBack, onContinue }: Props) {
  const moveSection = (index: number, delta: number) => {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onSectionsChange(next);
  };

  const removeSection = (index: number) => {
    onSectionsChange(sections.filter((_, i) => i !== index));
  };

  const addSection = (key: WorkoutSection['key']) => {
    onSectionsChange([...sections, { key, exercises: [] }]);
  };

  const availableKeys = SECTION_KEYS_IN_DEFAULT_ORDER.filter((k) => !sections.some((s) => s.key === k));

  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.workoutStructureTitle} subtitle={strings.workoutStructureSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.sm }}>
          {sections.map((section, index) => {
            const meta = SECTION_META[section.key];
            const Icon = meta.icon;
            return (
              <Card key={section.key} style={styles.row}>
                <View style={styles.iconWrap}>
                  <Icon size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>{meta.label}</Text>
                  <Text style={styles.sectionCaption}>{meta.required ? strings.required : strings.optional}</Text>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => moveSection(index, -1)}
                    disabled={index === 0}
                    hitSlop={6}
                    style={styles.actionBtn}
                  >
                    <Icons.chevronUp size={16} color={index === 0 ? colors.textTertiary : colors.textSecondary} strokeWidth={iconStrokeWidth} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => moveSection(index, 1)}
                    disabled={index === sections.length - 1}
                    hitSlop={6}
                    style={styles.actionBtn}
                  >
                    <Icons.chevronDown
                      size={16}
                      color={index === sections.length - 1 ? colors.textTertiary : colors.textSecondary}
                      strokeWidth={iconStrokeWidth}
                    />
                  </TouchableOpacity>
                  {!meta.required ? (
                    <TouchableOpacity onPress={() => removeSection(index)} hitSlop={6} style={styles.actionBtn}>
                      <Icons.trash size={15} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>

        {availableKeys.length > 0 ? (
          <>
            <Text style={styles.addSectionLabel}>{strings.addSection}</Text>
            <View style={styles.chipRow}>
              {availableKeys.map((key) => (
                <TouchableOpacity key={key} style={styles.chip} activeOpacity={0.8} onPress={() => addSection(key)}>
                  <Icons.plus size={13} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
                  <Text style={styles.chipLabel}>{SECTION_META[key].label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  sectionCaption: { color: colors.textTertiary, fontSize: 11.5, marginTop: 1, fontFamily: fontFamily.regular },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  addSectionLabel: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  chipLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
