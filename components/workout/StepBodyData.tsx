import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { strings } from '@/lib/strings';
import type { WorkoutBodyData, WorkoutBodyDataSource } from '@/lib/types';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { FieldCard } from './FieldCard';
import { WizardHeader } from './WizardHeader';

const SOURCE_OPTIONS: { key: WorkoutBodyDataSource; label: string }[] = [
  { key: 'automatic', label: strings.sourceAutomatic },
  { key: 'screenshot', label: strings.sourceScreenshot },
  { key: 'manual', label: strings.sourceManual },
];

const SOURCE_CAPTION: Record<WorkoutBodyDataSource, string> = {
  automatic: strings.sourceAutomaticCaption,
  screenshot: strings.sourceScreenshotCaption,
  manual: strings.sourceManualCaption,
};

const PRIMARY_FIELDS: { key: keyof WorkoutBodyData; label: string; placeholder: string }[] = [
  { key: 'avgHeartRate', label: strings.avgHeartRate, placeholder: strings.avgHeartRatePlaceholder },
  { key: 'calories', label: strings.calories, placeholder: strings.caloriesPlaceholder },
  { key: 'duration', label: strings.duration, placeholder: strings.durationPlaceholder },
  { key: 'zonesPct', label: strings.zones, placeholder: strings.zonesPlaceholder },
];

const EXTRA_FIELDS: { key: keyof WorkoutBodyData; label: string; placeholder: string }[] = [
  { key: 'distance', label: strings.distance, placeholder: strings.distancePlaceholder },
  { key: 'pace', label: strings.pace, placeholder: strings.pacePlaceholder },
  { key: 'power', label: strings.power, placeholder: strings.powerPlaceholder },
  { key: 'avgSpeed', label: strings.avgSpeed, placeholder: strings.avgSpeedPlaceholder },
  { key: 'maxHeartRate', label: strings.maxHeartRate, placeholder: strings.maxHeartRatePlaceholder },
  { key: 'device', label: strings.device, placeholder: strings.devicePlaceholder },
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
      <WizardHeader title={strings.addBodyDataTitle} subtitle={strings.addBodyDataSubtitle} onBack={onBack} />
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

        <Text style={styles.sectionTitle}>{strings.addMoreData}</Text>
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
        <GradientButton label={strings.continue} onPress={onContinue} />
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
