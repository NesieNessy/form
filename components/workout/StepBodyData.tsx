import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import type { WorkoutBodyData, WorkoutBodyDataSource } from '@/lib/types';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { FieldCard } from './FieldCard';
import { WizardHeader } from './WizardHeader';

const SOURCE_OPTIONS: { key: WorkoutBodyDataSource; label: string }[] = [
  { key: 'automatic', label: 'Automatic' },
  { key: 'screenshot', label: 'From Screenshot' },
  { key: 'manual', label: 'Manual' },
];

const SOURCE_CAPTION: Record<WorkoutBodyDataSource, string> = {
  automatic: 'Synced from your smartwatch, once connected.',
  screenshot: 'Detected from your fitness app screenshot.',
  manual: 'Enter your data by hand below.',
};

const PRIMARY_FIELDS: { key: keyof WorkoutBodyData; label: string; placeholder: string }[] = [
  { key: 'avgHeartRate', label: 'Avg Heart Rate', placeholder: 'e.g. 156 bpm' },
  { key: 'calories', label: 'Calories', placeholder: 'e.g. 324 kcal' },
  { key: 'duration', label: 'Duration', placeholder: 'e.g. 28:14' },
  { key: 'zonesPct', label: 'Zones', placeholder: 'e.g. 68%' },
];

const EXTRA_FIELDS: { key: keyof WorkoutBodyData; label: string; placeholder: string }[] = [
  { key: 'distance', label: 'Distance', placeholder: 'e.g. 5 km' },
  { key: 'pace', label: 'Pace', placeholder: 'e.g. 4:56 min/km' },
  { key: 'power', label: 'Power (Watts)', placeholder: 'e.g. 210 W' },
  { key: 'avgSpeed', label: 'Avg Speed', placeholder: 'e.g. 12.4 km/h' },
  { key: 'maxHeartRate', label: 'Max Heart Rate', placeholder: 'e.g. 178 bpm' },
  { key: 'device', label: 'Device', placeholder: 'e.g. Apple Watch' },
];

type Props = {
  source: WorkoutBodyDataSource;
  onSourceChange: (s: WorkoutBodyDataSource) => void;
  bodyData: WorkoutBodyData;
  onBodyDataChange: (patch: Partial<WorkoutBodyData>) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepBodyData({ source, onSourceChange, bodyData, onBodyDataChange, onBack, onContinue }: Props) {
  const [shown, setShown] = useState<Set<keyof WorkoutBodyData>>(
    () => new Set(EXTRA_FIELDS.map((f) => f.key).filter((k) => Boolean(bodyData[k])))
  );

  const toggleField = (key: keyof WorkoutBodyData) => {
    setShown((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        onBodyDataChange({ [key]: undefined });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      <WizardHeader title="Add Body Data" subtitle="Optional — heart rate, calories, or performance data." onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs
          options={SOURCE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          value={source}
          onChange={(k) => onSourceChange(k as WorkoutBodyDataSource)}
          scrollable
          size="sm"
        />
        <Text style={styles.caption}>{SOURCE_CAPTION[source]}</Text>

        <View style={styles.grid}>
          {PRIMARY_FIELDS.map((f) => (
            <View key={f.key} style={styles.gridItem}>
              <FieldCard
                label={f.label}
                placeholder={f.placeholder}
                value={bodyData[f.key] ?? ''}
                onChangeText={(v) => onBodyDataChange({ [f.key]: v })}
              />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Add More Data</Text>
        <View style={styles.pillRow}>
          {EXTRA_FIELDS.map((f) => {
            const active = shown.has(f.key);
            return (
              <GradientButton
                key={f.key}
                label={active ? `✓ ${f.label}` : f.label}
                variant="secondary"
                onPress={() => toggleField(f.key)}
              />
            );
          })}
        </View>

        {EXTRA_FIELDS.filter((f) => shown.has(f.key)).map((f) => (
          <FieldCard
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            value={bodyData[f.key] ?? ''}
            onChangeText={(v) => onBodyDataChange({ [f.key]: v })}
          />
        ))}
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
  caption: { color: colors.textTertiary, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.lg, fontFamily: fontFamily.regular },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.sm },
  gridItem: { flexBasis: '47%', flexGrow: 1 },
  sectionTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, marginTop: spacing.sm, marginBottom: spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
