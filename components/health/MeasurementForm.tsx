import { tr } from '@/lib/i18n/tr';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { formatDateLabel, isSameDay } from '@/lib/date';
import { METRICS, METRIC_ORDER, validateObservation, type MetricKey } from '@/lib/health/model';
import type { ObservationInput } from '@/lib/health/state';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const METRIC_TABS = METRIC_ORDER.map((m) => ({ key: m, label: METRICS[m].label }));
const METHOD_LABEL: Record<string, string> = { rmssd: 'RMSSD', sdnn: 'SDNN' };

type Props = {
  onSave: (input: ObservationInput) => void;
  onCancel: () => void;
};

/** One measurement typed in by the athlete. Sleep is entered as hours and minutes. */
export function MeasurementForm({ onSave, onCancel }: Props) {
  const [metric, setMetric] = useState<MetricKey>('resting_hr_bpm');
  const [value, setValue] = useState<number | undefined>(undefined);
  const [hours, setHours] = useState<number | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [method, setMethod] = useState('rmssd');
  const [date, setDate] = useState(() => new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const meta = METRICS[metric];
  const isSleep = metric === 'sleep_duration_min';

  const submit = () => {
    const resolved = isSleep ? (hours === undefined && minutes === undefined ? NaN : (hours ?? 0) * 60 + Math.min(59, minutes ?? 0)) : (value ?? NaN);
    // A past day is recorded at midday so it lands on that calendar day wherever the athlete is.
    const now = new Date();
    const observedAt = isSameDay(date, now) ? now.getTime() : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
    const input: ObservationInput = { metric, value: resolved, unit: meta.unit, observedAt, ...(meta.methods ? { method } : {}) };
    const issues = Number.isNaN(resolved) ? [{ message: tr(`Enter a value for ${meta.label.toLowerCase()}.`, `Gib einen Wert für ${meta.label} ein.`) }] : validateObservation(input, Date.now());
    if (issues.length) {
      setErrors(issues.map((i) => i.message));
      return;
    }
    onSave(input);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{strings.addMeasurement}</Text>
      <SegmentedTabs
        options={METRIC_TABS}
        value={metric}
        onChange={(key) => {
          setMetric(key as MetricKey);
          setValue(undefined);
          setErrors([]);
        }}
        scrollable
        size="sm"
      />

      <View style={styles.row}>
        {isSleep ? (
          <>
            <NumberField label={meta.label} suffix="h" value={hours} onChange={setHours} />
            <NumberField label=" " suffix={strings.min} value={minutes} onChange={setMinutes} />
          </>
        ) : (
          <NumberField
            label={meta.scale ? `${strings.measurementValue} (${meta.scale})` : strings.measurementValue}
            suffix={meta.unit || undefined}
            decimals={meta.decimals > 0}
            value={value}
            onChange={setValue}
          />
        )}
      </View>

      {meta.methods ? (
        <View style={styles.field}>
          <Text style={styles.label}>{strings.measurementMethod}</Text>
          <SegmentedTabs options={meta.methods.map((m) => ({ key: m, label: METHOD_LABEL[m] ?? m }))} value={method} onChange={setMethod} size="sm" />
        </View>
      ) : null}

      <TouchableOpacity style={styles.dateRow} activeOpacity={0.8} onPress={() => setPickingDate(true)}>
        <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{strings.measuredAt}</Text>
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
