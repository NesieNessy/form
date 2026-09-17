import { Repeat, Ruler, Flame as CaloriesIcon, Clock, Dumbbell, Hash, Type } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { IconPillSelector } from '@/components/ui/IconPillSelector';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Stepper } from '@/components/ui/Stepper';
import { FieldCard } from '@/components/workout/FieldCard';
import { strings } from '@/lib/strings';
import type { DistanceUnit, Exercise, ExercisePrimary, ExerciseTarget } from '@/lib/types';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { WizardHeader } from './WizardHeader';

const TARGET_OPTIONS = [
  { key: 'reps' as const, label: strings.targetReps, icon: Hash },
  { key: 'weight' as const, label: strings.targetWeight, icon: Dumbbell },
  { key: 'time' as const, label: strings.targetTime, icon: Clock },
  { key: 'distance' as const, label: strings.targetDistance, icon: Ruler },
  { key: 'calories' as const, label: strings.targetCalories, icon: CaloriesIcon },
  { key: 'rounds' as const, label: strings.targetRounds, icon: Repeat },
  { key: 'custom' as const, label: strings.targetCustom, icon: Type },
];

const NOTES_MAX = 100;

type Props = {
  initial: Exercise;
  isEditing: boolean;
  onBack: () => void;
  onSave: (exercise: Exercise) => void;
};

export function StepExerciseDetail({ initial, isEditing, onBack, onSave }: Props) {
  const [name, setName] = useState(initial.name);
  const [target, setTarget] = useState<ExerciseTarget>(initial.primary.target);
  const [reps, setReps] = useState(initial.primary.target === 'reps' ? initial.primary.reps : 10);
  const [rounds, setRounds] = useState(initial.primary.target === 'rounds' ? initial.primary.rounds : 3);
  const [calories, setCalories] = useState(initial.primary.target === 'calories' ? initial.primary.calories : 20);
  const [timeMin, setTimeMin] = useState(initial.primary.target === 'time' ? initial.primary.minutes : 1);
  const [timeSec, setTimeSec] = useState(initial.primary.target === 'time' ? initial.primary.seconds : 0);
  const [distanceValue, setDistanceValue] = useState(initial.primary.target === 'distance' ? initial.primary.value : 400);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(
    initial.primary.target === 'distance' ? initial.primary.unit : 'm'
  );
  const [weightPrimaryValue, setWeightPrimaryValue] = useState(initial.primary.target === 'weight' ? initial.primary.value : 20);
  const [customText, setCustomText] = useState(initial.primary.target === 'custom' ? initial.primary.text : '');
  const [extWeightValue, setExtWeightValue] = useState(initial.weight?.value ?? 0);
  const [extWeightMode, setExtWeightMode] = useState<'each' | 'total'>(initial.weight?.mode ?? 'total');
  const [notes, setNotes] = useState(initial.notes ?? '');

  const buildPrimary = (): ExercisePrimary => {
    switch (target) {
      case 'reps':
        return { target, reps };
      case 'rounds':
        return { target, rounds };
      case 'calories':
        return { target, calories };
      case 'time':
        return { target, minutes: timeMin, seconds: timeSec };
      case 'distance':
        return { target, value: distanceValue, unit: distanceUnit };
      case 'weight':
        return { target, value: weightPrimaryValue };
      case 'custom':
        return { target, text: customText };
    }
  };

  const handleSave = () => {
    onSave({
      id: initial.id,
      name,
      primary: buildPrimary(),
      weight: target !== 'weight' && extWeightValue > 0 ? { value: extWeightValue, mode: extWeightMode } : undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <View style={styles.screen}>
      <WizardHeader title={strings.exerciseDetailsTitle} subtitle={strings.exerciseDetailsSubtitle} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FieldCard
          label={strings.exerciseName}
          value={name}
          onChangeText={setName}
          placeholder={strings.exerciseNamePlaceholder}
        />

        <Text style={styles.sectionTitle}>{strings.target}</Text>
        <IconPillSelector options={TARGET_OPTIONS} value={target} onChange={setTarget} />

        {target === 'reps' ? <PrimaryStepper label={strings.repetitions} value={reps} onChange={setReps} min={1} /> : null}
        {target === 'rounds' ? <PrimaryStepper label={strings.targetRounds} value={rounds} onChange={setRounds} min={1} /> : null}
        {target === 'calories' ? (
          <PrimaryStepper label={strings.targetCalories} value={calories} onChange={setCalories} min={0} />
        ) : null}
        {target === 'weight' ? (
          <PrimaryStepper label={strings.targetWeight} value={weightPrimaryValue} onChange={setWeightPrimaryValue} min={0} suffix="kg" />
        ) : null}
        {target === 'time' ? (
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>{strings.min}</Text>
              <Stepper value={timeMin} onChange={setTimeMin} min={0} />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>{strings.sec}</Text>
              <Stepper value={timeSec} onChange={setTimeSec} min={0} max={59} step={5} />
            </View>
          </View>
        ) : null}
        {target === 'distance' ? (
          <View style={styles.timeRow}>
            <View style={[styles.timeField, { flex: 2 }]}>
              <Text style={styles.label}>{strings.targetDistance}</Text>
              <Stepper value={distanceValue} onChange={setDistanceValue} min={0} step={distanceUnit === 'km' ? 1 : 50} />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}> </Text>
              <SegmentedTabs
                options={[
                  { key: 'm', label: 'm' },
                  { key: 'km', label: 'km' },
                ]}
                value={distanceUnit}
                onChange={(k) => setDistanceUnit(k as DistanceUnit)}
                size="sm"
              />
            </View>
          </View>
        ) : null}
        {target === 'custom' ? (
          <FieldCard label={strings.targetCustom} value={customText} onChangeText={setCustomText} placeholder="e.g. Max Rep" />
        ) : null}

        {target !== 'weight' ? (
          <>
            <Text style={styles.sectionTitle}>{strings.weightOptional}</Text>
            <Card style={styles.weightCard}>
              <Stepper value={extWeightValue} onChange={setExtWeightValue} min={0} suffix="kg" />
              <SegmentedTabs
                options={[
                  { key: 'each', label: strings.eachArm },
                  { key: 'total', label: strings.total },
                ]}
                value={extWeightMode}
                onChange={(k) => setExtWeightMode(k as 'each' | 'total')}
                size="sm"
              />
            </Card>
          </>
        ) : null}

        <Card style={styles.notesCard}>
          <Text style={styles.label}>{strings.notesOptional}</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={(v) => setNotes(v.slice(0, NOTES_MAX))}
            placeholder={strings.notesPlaceholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={NOTES_MAX}
          />
          <Text style={styles.charCount}>
            {notes.length}/{NOTES_MAX}
          </Text>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label={isEditing ? strings.save : strings.saveExercise} onPress={handleSave} />
      </View>
    </View>
  );
}

function PrimaryStepper({
  label,
  value,
  onChange,
  min,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  suffix?: string;
}) {
  return (
    <Card style={styles.stepperCard}>
      <Text style={styles.label}>{label}</Text>
      <Stepper value={value} onChange={onChange} min={min} suffix={suffix} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginBottom: spacing.sm, marginTop: spacing.sm },
  stepperCard: { gap: spacing.sm, marginBottom: spacing.md },
  weightCard: { gap: spacing.md, marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  timeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  timeField: { flex: 1, gap: 6 },
  notesCard: { gap: 6, marginTop: spacing.sm },
  notesInput: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    padding: 0,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  charCount: { color: colors.textTertiary, fontSize: 11, textAlign: 'right', fontFamily: fontFamily.regular },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
