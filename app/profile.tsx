import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BenchmarkForm } from '@/components/profile/BenchmarkForm';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { Stepper } from '@/components/ui/Stepper';
import { FieldCard } from '@/components/workout/FieldCard';
import {
  EQUIPMENT_OPTIONS,
  benchmarkHistory,
  benchmarkTitle,
  currentBenchmarks,
  formatBenchmarkValue,
} from '@/lib/athlete/model';
import { strings } from '@/lib/strings';
import { SPORTS, type Sport } from '@/lib/workout/model';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const SPORT_LABEL: Record<Sport, string> = {
  crossfit: 'CrossFit',
  strength: 'Strength',
  endurance: 'Endurance',
  running: 'Running',
  cycling: 'Cycling',
  swimming: 'Swimming',
  triathlon: 'Triathlon',
  yoga: 'Yoga',
  hiit: 'HIIT',
  other: 'Other',
};

const SPORT_OPTIONS = SPORTS.map((s) => ({ key: s, label: SPORT_LABEL[s] }));
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: d, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] }));
const EQUIPMENT_CHIPS = EQUIPMENT_OPTIONS.map((e) => ({ key: e, label: e.charAt(0).toUpperCase() + e.slice(1) }));

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfileScreen() {
  const profile = useWorkoutsStore((s) => s.profile);
  const benchmarks = useWorkoutsStore((s) => s.benchmarks);
  const updateProfile = useWorkoutsStore((s) => s.updateProfile);
  const addBenchmark = useWorkoutsStore((s) => s.addBenchmark);
  const removeBenchmark = useWorkoutsStore((s) => s.removeBenchmark);

  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const all = useMemo(() => Object.values(benchmarks), [benchmarks]);
  const current = useMemo(() => currentBenchmarks(all), [all]);

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.profileTitle} subtitle={strings.profileSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FieldCard
          label={strings.displayName}
          value={profile.displayName ?? ''}
          onChangeText={(displayName) => updateProfile({ displayName: displayName.slice(0, 60) || undefined })}
          placeholder={strings.displayNamePlaceholder}
          cardStyle={{ marginBottom: 0 }}
        />

        <Text style={styles.sectionTitle}>{strings.yourSports}</Text>
        <ChipSelect options={SPORT_OPTIONS} selected={profile.sports} onToggle={(s) => updateProfile({ sports: toggle(profile.sports, s) })} />

        <Text style={styles.sectionTitle}>{strings.trainingRhythm}</Text>
        <Card style={styles.card}>
          <Text style={styles.label}>{strings.weeklyGoal}</Text>
          <Stepper
            value={profile.weeklySessionTarget}
            onChange={(weeklySessionTarget) => updateProfile({ weeklySessionTarget })}
            min={1}
            max={14}
            suffix={strings.sessionsPerWeek}
          />
          <Text style={[styles.label, { marginTop: spacing.sm }]}>{strings.usualSessionLength}</Text>
          <Stepper
            value={profile.minutesPerSession ?? 0}
            onChange={(m) => updateProfile({ minutesPerSession: m > 0 ? m : undefined })}
            min={0}
            max={300}
            step={5}
            suffix={profile.minutesPerSession ? strings.min : `· ${strings.notSet}`}
          />
        </Card>
        <Text style={styles.label}>{strings.usualTrainingDays}</Text>
        <ChipSelect
          options={DAY_OPTIONS}
          selected={profile.availableDays}
          onToggle={(d) => updateProfile({ availableDays: toggle(profile.availableDays, d).sort((a, b) => a - b) })}
        />

        <Text style={styles.sectionTitle}>{strings.yourEquipment}</Text>
        <ChipSelect options={EQUIPMENT_CHIPS} selected={profile.equipment} onToggle={(e) => updateProfile({ equipment: toggle(profile.equipment, e) })} />

        <Text style={styles.sectionTitle}>{strings.benchmarks}</Text>
        <Text style={styles.hint}>{strings.benchmarksHint}</Text>

        {current.length === 0 && !adding ? <Text style={styles.empty}>{strings.noBenchmarksYet}</Text> : null}

        {current.map((b) => {
          const key = `${b.kind}:${b.activityId ?? ''}`;
          const open = expanded === key;
          const history = open ? benchmarkHistory(all, b) : [];
          return (
            <Card key={key} style={styles.benchmarkCard}>
              <TouchableOpacity style={styles.benchmarkRow} activeOpacity={0.7} onPress={() => setExpanded(open ? null : key)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benchmarkTitle}>{benchmarkTitle(b)}</Text>
                  <Text style={styles.benchmarkMeta}>{shortDate(b.measuredOn)}</Text>
                </View>
                <Text style={styles.benchmarkValue}>{formatBenchmarkValue(b)}</Text>
                {open ? (
                  <Icons.chevronUp size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                ) : (
                  <Icons.chevronDown size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                )}
              </TouchableOpacity>
              {history.map((h) => (
                <View key={h.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{shortDate(h.measuredOn)}</Text>
                  <Text style={styles.historyValue}>{formatBenchmarkValue(h)}</Text>
                  <TouchableOpacity onPress={() => removeBenchmark(h.id)} hitSlop={8} accessibilityLabel={`${strings.deleteWorkout} ${formatBenchmarkValue(h)}`}>
                    <Icons.trash size={15} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          );
        })}

        {adding ? (
          <BenchmarkForm
            onCancel={() => setAdding(false)}
            onSave={(input) => {
              addBenchmark(input);
              setAdding(false);
            }}
          />
        ) : (
          <GradientButton
            label={strings.addBenchmark}
            variant="secondary"
            icon={<Icons.plus size={16} color={colors.text} strokeWidth={iconStrokeWidth} />}
            onPress={() => setAdding(true)}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  hint: { color: colors.textTertiary, fontSize: 12.5, lineHeight: 18, marginTop: -spacing.sm, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  benchmarkCard: { gap: spacing.sm },
  benchmarkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benchmarkTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  benchmarkMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 1, fontFamily: fontFamily.regular },
  benchmarkValue: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyDate: { flex: 1, color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  historyValue: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
});
