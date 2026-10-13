import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import {
  BENCHMARK_KINDS,
  BENCHMARK_KIND_ORDER,
  LOADABLE_ACTIVITIES,
  todayIso,
  validateBenchmark,
  type BenchmarkKind,
} from '@/lib/athlete/model';
import { formatDateLabel } from '@/lib/date';
import { strings } from '@/lib/strings';
import type { BenchmarkInput } from '@/lib/workout/state';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const KIND_TABS = BENCHMARK_KIND_ORDER.map((kind) => ({ key: kind, label: BENCHMARK_KINDS[kind].label }));
const LIFT_OPTIONS = LOADABLE_ACTIVITIES.map((a) => ({ key: a.id, label: a.name }));
const UNIT_SUFFIX: Record<string, string> = { kg: 'kg', w: 'W', bpm: 'bpm' };

type Props = {
  onSave: (input: BenchmarkInput) => void;
  onCancel: () => void;
};

/** Entry of one dated reference value. Pace benchmarks are typed as minutes and seconds. */
export function BenchmarkForm({ onSave, onCancel }: Props) {
  const [kind, setKind] = useState<BenchmarkKind>('one_rep_max');
  const [activityId, setActivityId] = useState<string | undefined>(undefined);
  const [value, setValue] = useState<number | undefined>(undefined);
  const [paceMin, setPaceMin] = useState<number | undefined>(undefined);
  const [paceSec, setPaceSec] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(() => new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const meta = BENCHMARK_KINDS[kind];

  const submit = () => {
    const resolved = meta.isPace
      ? paceMin === undefined && paceSec === undefined
        ? 0
        : (paceMin ?? 0) * 60 + Math.min(59, paceSec ?? 0)
      : (value ?? 0);
    const input: BenchmarkInput = {
      kind,
      activityId: meta.needsActivity ? activityId : undefined,
      value: resolved,
      unit: meta.unit,
      measuredOn: todayIso(date),
      source: 'manual',
    };
    const issues = validateBenchmark(input);
    if (issues.length) {
      setErrors(issues.map((i) => i.message));
      return;
    }
    onSave(input);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{strings.addBenchmark}</Text>
      <SegmentedTabs
        options={KIND_TABS}
        value={kind}
        onChange={(key) => {
          setKind(key as BenchmarkKind);
          setErrors([]);
        }}
        scrollable
        size="sm"
      />

      {meta.needsActivity ? (
        <View style={styles.field}>
          <Text style={styles.label}>{strings.benchmarkLift}</Text>
          <ChipSelect options={LIFT_OPTIONS} selected={activityId ? [activityId] : []} onToggle={(id) => setActivityId(id === activityId ? undefined : id)} />
        </View>
      ) : null}

      <View style={styles.row}>
        {meta.isPace ? (
          <>
            <NumberField label={meta.unit === 'sec_per_km' ? strings.pacePerKm : strings.pacePer100m} suffix={strings.minutesShort} value={paceMin} onChange={setPaceMin} />
            <NumberField label=" " suffix={strings.secondsShort} value={paceSec} onChange={setPaceSec} />
          </>
        ) : (
          <NumberField label={strings.benchmarkValue} suffix={UNIT_SUFFIX[meta.unit]} decimals={meta.unit === 'kg'} value={value} onChange={setValue} />
        )}
      </View>

      <TouchableOpacity style={styles.dateRow} activeOpacity={0.8} onPress={() => setPickingDate(true)}>
        <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{strings.measuredOn}</Text>
          <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
        </View>
        <Icons.chevronDown size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
      </TouchableOpacity>
      <DatePickerModal
        visible={pickingDate}
        date={date}
        onClose={() => setPickingDate(false)}
        onSelect={(d) => {
          setDate(d);
          setPickingDate(false);
        }}
      />

      {errors.map((message) => (
        <Text key={message} style={styles.error} accessibilityLiveRegion="polite">
          {message}
        </Text>
      ))}

      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <GradientButton label={strings.save} style={{ flex: 1 }} onPress={submit} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  field: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  row: { flexDirection: 'row', gap: spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginTop: 2 },
  error: { color: colors.red, fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
});
