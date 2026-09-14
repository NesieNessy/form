import { Calendar, ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { formatDateLabel } from '@/lib/date';
import { strings } from '@/lib/strings';
import type { Exercise, WorkoutPartKey, WorkoutSetup, WorkoutType } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { DatePickerModal } from './DatePickerModal';
import { ExerciseListEditor } from './ExerciseListEditor';
import { FieldCard } from './FieldCard';
import { WizardHeader } from './WizardHeader';
import { WorkoutTypeSelector } from './WorkoutTypeSelector';

type Props = {
  title: string;
  onTitleChange: (v: string) => void;
  date: Date;
  onDateChange: (v: Date) => void;
  warmup: Exercise[];
  onWarmupChange: (exercises: Exercise[]) => void;
  strength: Exercise[];
  onStrengthChange: (exercises: Exercise[]) => void;
  skill: Exercise[];
  onSkillChange: (exercises: Exercise[]) => void;
  workoutType: WorkoutType;
  onWorkoutTypeChange: (v: WorkoutType) => void;
  setup: WorkoutSetup;
  onSetupChange: (patch: Partial<WorkoutSetup>) => void;
  intervalsLabel: string;
  onIntervalsChange: (v: string) => void;
  exercises: Exercise[];
  onExercisesChange: (exercises: Exercise[]) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

const PART_CONFIG: { key: WorkoutPartKey; title: string; addLabel: string }[] = [
  { key: 'warmup', title: strings.warmup, addLabel: strings.addWarmup },
  { key: 'strength', title: strings.strength, addLabel: strings.addStrength },
  { key: 'skill', title: strings.skill, addLabel: strings.addSkill },
];

export function StepEditWorkout({
  title,
  onTitleChange,
  date,
  onDateChange,
  warmup,
  onWarmupChange,
  strength,
  onStrengthChange,
  skill,
  onSkillChange,
  workoutType,
  onWorkoutTypeChange,
  setup,
  onSetupChange,
  intervalsLabel,
  onIntervalsChange,
  exercises,
  onExercisesChange,
  notes,
  onNotesChange,
  onBack,
  onContinue,
}: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const partList: Record<WorkoutPartKey, Exercise[]> = { warmup, strength, skill };
  const partOnChange: Record<WorkoutPartKey, (exercises: Exercise[]) => void> = {
    warmup: onWarmupChange,
    strength: onStrengthChange,
    skill: onSkillChange,
  };
  const [activeParts, setActiveParts] = useState<Set<WorkoutPartKey>>(
    () => new Set(PART_CONFIG.filter((p) => partList[p.key].length > 0).map((p) => p.key))
  );

  const addPart = (key: WorkoutPartKey) => setActiveParts((prev) => new Set(prev).add(key));
  const removePart = (key: WorkoutPartKey) => {
    partOnChange[key]([]);
    setActiveParts((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.editWorkoutTitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FieldCard label={strings.title} value={title} onChangeText={onTitleChange} placeholder={strings.titlePlaceholder} />

        <TouchableOpacity activeOpacity={0.8} onPress={() => setPickerVisible(true)}>
          <Card style={styles.dateCard}>
            <Calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{strings.date}</Text>
              <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
            </View>
            <ChevronDown size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
          </Card>
        </TouchableOpacity>

        <DatePickerModal
          visible={pickerVisible}
          date={date}
          onClose={() => setPickerVisible(false)}
          onSelect={(d) => {
            onDateChange(d);
            setPickerVisible(false);
          }}
        />

        {PART_CONFIG.filter((p) => activeParts.has(p.key)).map((p) => (
          <View key={p.key} style={styles.partSection}>
            <View style={styles.partHeader}>
              <Text style={styles.sectionTitle}>{p.title}</Text>
              <TouchableOpacity onPress={() => removePart(p.key)} hitSlop={8}>
                <Trash2 size={15} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <ExerciseListEditor
              exercises={partList[p.key]}
              onChange={partOnChange[p.key]}
              addLabel={strings.addExercise}
            />
          </View>
        ))}

        {PART_CONFIG.some((p) => !activeParts.has(p.key)) ? (
          <View style={styles.addPartRow}>
            {PART_CONFIG.filter((p) => !activeParts.has(p.key)).map((p) => (
              <TouchableOpacity key={p.key} style={styles.addPartChip} activeOpacity={0.8} onPress={() => addPart(p.key)}>
                <Plus size={14} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
                <Text style={styles.addPartLabel}>{p.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{strings.workoutOfTheDay}</Text>
        <WorkoutTypeSelector value={workoutType} onChange={onWorkoutTypeChange} />

        {workoutType === 'emom' ? (
          <>
            <Text style={styles.subsectionTitle}>{strings.emomSetup}</Text>
            <View style={styles.setupRow}>
              <FieldCard
                cardStyle={styles.setupField}
                label={strings.interval}
                value={setup.interval ?? ''}
                onChangeText={(v) => onSetupChange({ interval: v })}
                placeholder={strings.intervalPlaceholder}
              />
              <FieldCard
                cardStyle={styles.setupField}
                label={strings.rounds}
                value={setup.rounds ?? ''}
                onChangeText={(v) => onSetupChange({ rounds: v })}
                placeholder={strings.roundsPlaceholder}
              />
            </View>
          </>
        ) : null}

        {workoutType === 'amrap' ? (
          <>
            <Text style={styles.subsectionTitle}>{strings.amrapSetup}</Text>
            <FieldCard
              label={strings.timeCap}
              value={setup.timeCap ?? ''}
              onChangeText={(v) => onSetupChange({ timeCap: v })}
              placeholder={strings.timeCapPlaceholder}
            />
          </>
        ) : null}

        {workoutType === 'forTime' ? (
          <>
            <Text style={styles.subsectionTitle}>{strings.forTimeSetup}</Text>
            <View style={styles.setupRow}>
              <FieldCard
                cardStyle={styles.setupField}
                label={strings.rounds}
                value={setup.rounds ?? ''}
                onChangeText={(v) => onSetupChange({ rounds: v })}
                placeholder={strings.roundsPlaceholder}
              />
              <FieldCard
                cardStyle={styles.setupField}
                label={strings.timeCap}
                value={setup.timeCap ?? ''}
                onChangeText={(v) => onSetupChange({ timeCap: v })}
                placeholder={strings.timeCapPlaceholder}
              />
            </View>
          </>
        ) : null}

        {workoutType === 'tabata' ? (
          <>
            <Text style={styles.subsectionTitle}>{strings.tabataSetup}</Text>
            <View style={styles.setupRow}>
              <FieldCard
                cardStyle={styles.setupField}
                label={strings.work}
                value={setup.work ?? ''}
                onChangeText={(v) => onSetupChange({ work: v })}
                placeholder={strings.workPlaceholder}
              />
              <FieldCard
                cardStyle={styles.setupField}
                label={strings.rest}
                value={setup.rest ?? ''}
                onChangeText={(v) => onSetupChange({ rest: v })}
                placeholder={strings.restPlaceholder}
              />
            </View>
            <FieldCard
              label={strings.rounds}
              value={setup.rounds ?? ''}
              onChangeText={(v) => onSetupChange({ rounds: v })}
              placeholder={strings.roundsPlaceholder}
            />
          </>
        ) : null}

        {workoutType === 'mix' ? (
          <FieldCard
            label={strings.intervals}
            value={intervalsLabel}
            onChangeText={onIntervalsChange}
            placeholder={strings.intervalsPlaceholder}
          />
        ) : null}

        <Text style={styles.subsectionTitle}>{strings.exercises}</Text>
        <ExerciseListEditor exercises={exercises} onChange={onExercisesChange} addLabel={strings.addExercise} />

        <Card style={styles.notesCard}>
          <Text style={styles.label}>{strings.notes}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={onNotesChange}
            placeholder={strings.notesPlaceholder}
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </Card>
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
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  dateValue: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  subsectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fontFamily.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  partSection: { marginBottom: spacing.lg },
  partHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  addPartRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  addPartChip: {
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
  addPartLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
  setupRow: { flexDirection: 'row', gap: spacing.sm },
  setupField: { flex: 1 },
  notesCard: { gap: 6 },
  notesInput: { color: colors.text, fontSize: 14, fontFamily: fontFamily.regular, padding: 0, minHeight: 60, textAlignVertical: 'top' },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
