import { tr } from '@/lib/i18n/tr';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { LOADABLE_ACTIVITIES } from '@/lib/athlete/model';
import { formatDateLabel } from '@/lib/date';
import { formatGoalValue, type GoalMetric } from '@/lib/goals/model';
import type { ProgressInputs } from '@/lib/goals/progress';
import { suggestBaseline, type GoalInput } from '@/lib/goals/state';
import { BODY_REGION_LABEL, RTS_LABEL, type InjuryEpisode, type RtsStage } from '@/lib/rehab/model';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Kind = GoalMetric['kind'];
const DISTANCES: Record<'running' | 'cycling' | 'swimming', { key: string; label: string; meters: number }[]> = {
  running: [
    { key: '5000', label: '5 km', meters: 5000 },
    { key: '10000', label: '10 km', meters: 10000 },
    { key: '21097', label: tr('Half marathon', 'Halbmarathon'), meters: 21097 },
    { key: '42195', label: tr('Marathon', 'Marathon'), meters: 42195 },
  ],
  cycling: [
    { key: '20000', label: '20 km', meters: 20000 },
    { key: '40000', label: '40 km', meters: 40000 },
    { key: '90000', label: '90 km', meters: 90000 },
  ],
  swimming: [
    { key: '400', label: '400 m', meters: 400 },
    { key: '1500', label: '1500 m', meters: 1500 },
    { key: '3800', label: '3800 m', meters: 3800 },
  ],
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Props = { evidence: ProgressInputs; episodes: InjuryEpisode[]; onSave: (input: GoalInput) => { ok: boolean; error?: string }; onCancel: () => void };

export function GoalForm({ evidence, episodes, onSave, onCancel }: Props) {
  const [kind, setKind] = useState<Kind>('one_rep_max');
  const [lift, setLift] = useState(LOADABLE_ACTIVITIES[0].id);
  const [bench, setBench] = useState<'ftp' | 'threshold_pace' | 'css_pace'>('ftp');
  const [sport, setSport] = useState<'running' | 'cycling' | 'swimming'>('running');
  const [meters, setMeters] = useState(5000);
  const [value, setValue] = useState<number | undefined>(undefined);
  const [h, setH] = useState<number | undefined>(undefined);
  const [m, setM] = useState<number | undefined>(undefined);
  const [s, setS] = useState<number | undefined>(undefined);
  const [eventName, setEventName] = useState('');
  const [episodeId, setEpisodeId] = useState(episodes[0]?.id ?? '');
  const [stage, setStage] = useState<RtsStage>('participation');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date(Date.now() + 90 * 86_400_000));
  const [picking, setPicking] = useState(false);
  const [milestones, setMilestones] = useState<{ label: string; value?: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const kinds: { key: Kind; label: string }[] = [
    { key: 'one_rep_max', label: strings.kindLift },
    { key: 'benchmark', label: strings.kindBenchmark },
    { key: 'distance_time', label: strings.kindDistance },
    { key: 'sessions_per_week', label: strings.kindSessions },
    { key: 'nutrition_logging', label: strings.kindNutrition },
    { key: 'event', label: strings.kindEvent },
    ...(episodes.length ? [{ key: 'rehab_stage' as Kind, label: strings.kindRehab }] : []),
  ];

  const metric: GoalMetric = useMemo(() => {
    switch (kind) {
      case 'one_rep_max':
        return { kind, activityId: lift };
      case 'benchmark':
        return { kind, benchmark: bench };
      case 'distance_time':
        return { kind, sport, meters };
      case 'sessions_per_week':
        return { kind, perWeek: value ?? 3 };
      case 'nutrition_logging':
        return { kind, daysPerWeek: value ?? 5 };
      case 'event':
        return { kind, name: eventName };
      default:
        return { kind: 'rehab_stage', episodeId, stage };
    }
  }, [kind, lift, bench, sport, meters, value, eventName, episodeId, stage]);

  const usesClock = kind === 'distance_time' || (kind === 'benchmark' && bench !== 'ftp');
  const target = usesClock ? ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0) || undefined) : kind === 'event' || kind === 'rehab_stage' ? undefined : value;
  const baseline = ['one_rep_max', 'benchmark', 'distance_time'].includes(kind) ? suggestBaseline(metric, evidence) : undefined;
  const suggestedTitle =
    kind === 'one_rep_max'
      ? `${LOADABLE_ACTIVITIES.find((a) => a.id === lift)?.name ?? tr('Lift', 'Übung')}${target ? ` ${target} kg` : ''}`
      : kind === 'distance_time'
        ? `${DISTANCES[sport].find((d) => d.meters === meters)?.label ?? ''}${target ? ` ${tr('in', 'in')} ${formatGoalValue(metric, target)}` : ''}`
        : kind === 'event'
          ? tr(`Finish ${eventName}`, `${eventName} beenden`)
          : kind === 'sessions_per_week'
            ? tr(`${value ?? 3} sessions a week`, `${value ?? 3} Einheiten pro Woche`)
            : kind === 'nutrition_logging'
              ? tr(`Log food ${value ?? 5} days a week`, `An ${value ?? 5} Tagen pro Woche Essen erfassen`)
              : kind === 'rehab_stage'
                ? RTS_LABEL[stage]
                : bench === 'ftp'
                  ? `FTP ${target ?? ''} W`
                  : tr(`${bench === 'threshold_pace' ? 'Threshold' : 'CSS'} pace ${target ? formatGoalValue(metric, target) : ''}`, `${bench === 'threshold_pace' ? 'Schwellenpace' : 'CSS-Pace'} ${target ? formatGoalValue(metric, target) : ''}`);

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{strings.goalKind}</Text>
      <SegmentedTabs options={kinds} value={kind} onChange={(k) => (setKind(k as Kind), setValue(undefined), setError(null))} scrollable size="sm" />

      {kind === 'one_rep_max' ? <SegmentedTabs options={LOADABLE_ACTIVITIES.map((a) => ({ key: a.id, label: a.name }))} value={lift} onChange={setLift} scrollable size="sm" /> : null}
      {kind === 'benchmark' ? (
        <SegmentedTabs options={[{ key: 'ftp', label: 'FTP' }, { key: 'threshold_pace', label: tr('Threshold pace', 'Schwellenpace') }, { key: 'css_pace', label: tr('CSS pace', 'CSS-Pace') }]} value={bench} onChange={(k) => setBench(k as typeof bench)} size="sm" />
      ) : null}
      {kind === 'distance_time' ? (
        <>
          <SegmentedTabs options={[{ key: 'running', label: tr('Run', 'Laufen') }, { key: 'cycling', label: tr('Ride', 'Rad') }, { key: 'swimming', label: tr('Swim', 'Schwimmen') }]} value={sport} onChange={(k) => (setSport(k as typeof sport), setMeters(DISTANCES[k as typeof sport][0].meters))} size="sm" />
          <SegmentedTabs options={DISTANCES[sport].map((d) => ({ key: d.key, label: d.label }))} value={String(meters)} onChange={(k) => setMeters(Number(k))} scrollable size="sm" />
        </>
      ) : null}
      {kind === 'event' ? <FieldCard label={strings.goalEventName} value={eventName} onChangeText={setEventName} placeholder={strings.goalEventPlaceholder} cardStyle={styles.inset} /> : null}
      {kind === 'rehab_stage' ? (
        <>
          <SegmentedTabs options={episodes.map((e) => ({ key: e.id, label: BODY_REGION_LABEL[e.bodyRegion] }))} value={episodeId} onChange={setEpisodeId} scrollable size="sm" />
          <SegmentedTabs options={(Object.keys(RTS_LABEL) as RtsStage[]).map((k) => ({ key: k, label: RTS_LABEL[k] }))} value={stage} onChange={(k) => setStage(k as RtsStage)} scrollable size="sm" />
          <Text style={styles.hint}>{strings.rehabGoalNote}</Text>
        </>
      ) : null}

      {usesClock ? (
        <View style={styles.row}>
          <NumberField label={`${strings.goalTarget} (h)`} value={h} onChange={setH} />
          <NumberField label="min" value={m} onChange={setM} />
          <NumberField label="s" value={s} onChange={setS} />
        </View>
      ) : kind !== 'event' && kind !== 'rehab_stage' ? (
        <NumberField
          label={kind === 'one_rep_max' ? `${strings.goalTarget} (kg)` : kind === 'benchmark' ? `${strings.goalTarget} (W)` : `${strings.goalTarget} (${strings.goalPerWeek.toLowerCase()})`}
          decimals={kind === 'one_rep_max'}
          value={value}
          onChange={setValue}
        />
      ) : null}

      {['one_rep_max', 'benchmark', 'distance_time'].includes(kind) ? (
        <Text style={styles.hint}>{baseline ? strings.goalBaselineFound(baseline.source) : strings.goalBaselineMissing}</Text>
      ) : null}

      <TouchableOpacity style={styles.dateRow} onPress={() => setPicking(true)}>
        <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <Text style={styles.label}>{strings.goalTargetDate}</Text>
        <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
      </TouchableOpacity>
      <DatePickerModal visible={picking} date={date} onClose={() => setPicking(false)} onSelect={(d) => (setDate(d), setPicking(false))} />

      <FieldCard label={strings.goalName} value={title} onChangeText={setTitle} placeholder={suggestedTitle} maxLength={120} cardStyle={styles.inset} />

      {target !== undefined && ['one_rep_max', 'benchmark', 'distance_time'].includes(kind) ? (
        <>
          <Text style={styles.label}>{strings.goalMilestones}</Text>
          {milestones.map((ms, i) => (
            <View key={i} style={styles.row}>
              <FieldCard label={strings.goalMilestoneLabel} value={ms.label} onChangeText={(label) => setMilestones((cur) => cur.map((x, j) => (j === i ? { ...x, label } : x)))} cardStyle={[styles.inset, { flex: 1 }]} />
              <NumberField label={usesClock ? 's' : kind === 'one_rep_max' ? 'kg' : 'W'} value={ms.value} onChange={(v) => setMilestones((cur) => cur.map((x, j) => (j === i ? { ...x, value: v } : x)))} />
            </View>
          ))}
          <GradientButton label={strings.addMilestone} variant="tertiary" onPress={() => setMilestones((cur) => [...cur, { label: '' }])} />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <GradientButton
          label={strings.saveGoal}
          style={{ flex: 1 }}
          onPress={() => {
            const res = onSave({
              title: (title.trim() || suggestedTitle).trim(),
              metric,
              target: kind === 'sessions_per_week' || kind === 'nutrition_logging' ? (value ?? undefined) : target,
              targetDate: iso(date),
              ...(baseline ? { baseline } : {}),
              milestones: milestones.filter((x) => x.label.trim()),
            });
            if (!res.ok) setError(res.error ?? null);
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginLeft: 'auto' },
  error: { color: colors.red, fontSize: 13, fontFamily: fontFamily.regular },
});
