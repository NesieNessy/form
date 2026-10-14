import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { useAuthStore } from '@/lib/auth';
import { formatDateLabel } from '@/lib/date';
import { formatGoalValue, type Goal, type GoalRevision } from '@/lib/goals/model';
import { goalProgress } from '@/lib/goals/progress';
import { goalReviews, type GoalReview } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { getWorkoutData, progressInputsOf, useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const usesClock = (g: Goal) => g.metric.kind === 'distance_time' || (g.metric.kind === 'benchmark' && g.metric.benchmark !== 'ftp');
const isHabit = (g: Goal) => g.metric.kind === 'sessions_per_week' || g.metric.kind === 'nutrition_logging';

function describeChange(goal: Goal, r: GoalRevision): string {
  const show = (key: string, v: string | number | null) =>
    v === null ? '–' : key === 'target' && typeof v === 'number' && !isHabit(goal) ? formatGoalValue(goal.metric, v) : key === 'status' ? strings.goalStatus[String(v)] ?? String(v) : String(v);
  return Object.entries(r.changes)
    .map(([key, c]) => `${key === 'targetDate' ? strings.goalTargetDate : key === 'status' ? 'Status' : key === 'title' ? strings.goalName : strings.goalTarget}: ${show(key, c!.from)} → ${show(key, c!.to)}`)
    .join('; ');
}

export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const goal = useWorkoutsStore((s) => s.goals[id]);
  // Progress follows the evidence it is calculated from.
  const benchmarks = useWorkoutsStore((s) => s.benchmarks);
  const sessions = useWorkoutsStore((s) => s.sessions);
  const activities = useWorkoutsStore((s) => s.activities);
  const foodLog = useWorkoutsStore((s) => s.foodLog);
  const clinical = useWorkoutsStore((s) => s.clinical);
  const reviseGoal = useWorkoutsStore((s) => s.reviseGoal);
  const setGoalStatus = useWorkoutsStore((s) => s.setGoalStatus);
  const setGoalVisibility = useWorkoutsStore((s) => s.setGoalVisibility);
  const recordEventFinished = useWorkoutsStore((s) => s.recordEventFinished);
  const removeGoal = useWorkoutsStore((s) => s.removeGoal);
  const refreshGoals = useWorkoutsStore((s) => s.refreshGoals);

  const [revising, setRevising] = useState(false);
  const [target, setTarget] = useState<number | undefined>(undefined);
  const [h, setH] = useState<number | undefined>(undefined);
  const [m, setM] = useState<number | undefined>(undefined);
  const [s, setS] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(new Date());
  const [picking, setPicking] = useState<'target' | 'finished' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<GoalReview[]>([]);

  useFocusEffect(
    useCallback(() => {
      refreshGoals();
    }, [refreshGoals])
  );
  useEffect(() => {
    if (signedIn && goal?.visibility === 'shared') goalReviews(id).then(setReviews, () => setReviews([]));
  }, [signedIn, id, goal?.visibility]);

  const progress = useMemo(
    () => (goal ? goalProgress(goal, progressInputsOf({ ...getWorkoutData(), benchmarks, sessions, activities, foodLog, clinical }, Date.now())) : undefined),
    [goal, benchmarks, sessions, activities, foodLog, clinical]
  );

  if (!goal || goal.deletedAt || !progress) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.goalsTitle} />
        <Text style={[styles.body, { paddingHorizontal: spacing.screenX }]}>{strings.noGoals}</Text>
      </View>
    );
  }

  const startRevise = () => {
    const t = goal.target;
    setTarget(t);
    setH(t !== undefined ? Math.floor(t / 3600) : undefined);
    setM(t !== undefined ? Math.floor((t % 3600) / 60) : undefined);
    setS(t !== undefined ? Math.round(t % 60) : undefined);
    setDate(fromIso(goal.targetDate));
    setReason('');
    setError(null);
    setRevising(true);
  };
  const pct = progress.fraction !== undefined ? Math.round(Math.min(1, Math.max(0, progress.fraction)) * 100) : undefined;
  const hasTarget = goal.metric.kind !== 'event' && goal.metric.kind !== 'rehab_stage';
  const value = (v: number) => (isHabit(goal) ? String(v) : formatGoalValue(goal.metric, v));

  return (
    <View style={styles.screen}>
      <DetailHeader title={goal.title} subtitle={`${strings.goalStatus[goal.status]} · ${strings.goalTargetDate.toLowerCase()} ${goal.targetDate}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.summary}>{progress.summary}</Text>
          {pct !== undefined ? (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.between}>
                <Text style={styles.meta}>{goal.baseline ? `${strings.goalBaseline}: ${value(goal.baseline.value)}` : ''}</Text>
                <Text style={styles.meta}>{goal.target !== undefined ? `${strings.goalTarget}: ${value(goal.target)}` : ''}</Text>
              </View>
            </>
          ) : goal.target !== undefined ? (
            <Text style={styles.meta}>{`${strings.goalTarget}: ${value(goal.target)}`}</Text>
          ) : null}
          {goal.milestones.length ? (
            <View style={{ gap: 4 }}>
              {goal.milestones.map((ms) => (
                <Text key={ms.id} style={styles.body}>
                  {`${ms.reachedAt ? '✓' : '○'} ${ms.label}${ms.value !== undefined ? ` (${value(ms.value)})` : ''}${ms.reachedAt ? ` — ${strings.goalReached} ${day(ms.reachedAt)}` : ''}`}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>

        {progress.weeks?.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.goalWeeks}</Text>
            <View style={styles.weeks}>
              {progress.weeks.map((w) => (
                <View key={w.weekStart} style={[styles.week, w.met && styles.weekMet]}>
                  <Text style={styles.weekCount}>{w.count}</Text>
                  <Text style={styles.weekLabel}>{w.weekStart.slice(5)}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.goalEvidence}</Text>
          {progress.evidence.length === 0 ? <Text style={styles.body}>{strings.goalNoEvidence}</Text> : null}
          {progress.evidence
            .slice(-12)
            .reverse()
            .map((e, i) => (
              <View key={`${e.date}-${i}`} style={styles.between}>
                <Text style={styles.body} numberOfLines={1}>{`${e.date} · ${e.label}`}</Text>
                <Text style={styles.value}>{goal.metric.kind === 'rehab_stage' || goal.metric.kind === 'event' ? '' : value(e.value)}</Text>
              </View>
            ))}
          {progress.notes.length ? (
            <>
              <Text style={[styles.cardTitle, { marginTop: spacing.sm }]}>{strings.goalNotes}</Text>
              {progress.notes.map((n) => (
                <Text key={n} style={styles.hint}>{`• ${n}`}</Text>
              ))}
            </>
          ) : null}
        </Card>

        {goal.metric.kind === 'event' && goal.status === 'active' && !goal.completedOn ? (
          <GradientButton label={strings.goalFinished} icon={<Icons.trophy size={16} color="#fff" strokeWidth={iconStrokeWidth} />} onPress={() => setPicking('finished')} />
        ) : null}

        {revising ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.goalChangeTarget}</Text>
            {hasTarget ? (
              usesClock(goal) ? (
                <View style={styles.row}>
                  <NumberField label={`${strings.goalTarget} (h)`} value={h} onChange={setH} />
                  <NumberField label="min" value={m} onChange={setM} />
                  <NumberField label="s" value={s} onChange={setS} />
                </View>
              ) : (
                <NumberField label={strings.goalTarget} value={target} onChange={setTarget} decimals={goal.metric.kind === 'one_rep_max'} />
              )
            ) : null}
            <TouchableOpacity style={styles.row} onPress={() => setPicking('target')}>
              <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
              <Text style={styles.meta}>{strings.goalTargetDate}</Text>
              <Text style={[styles.value, { marginLeft: 'auto' }]}>{formatDateLabel(date)}</Text>
            </TouchableOpacity>
            <FieldCard label={strings.goalChangeReason} value={reason} onChangeText={setReason} maxLength={300} cardStyle={styles.inset} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.row}>
              <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setRevising(false)} />
              <GradientButton
                label={strings.goalSaveChange}
                style={{ flex: 1 }}
                onPress={() => {
                  const nextTarget = !hasTarget ? undefined : usesClock(goal) ? (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0) || undefined : target;
                  const patch: { target?: number; targetDate?: string } = {};
                  if (hasTarget && nextTarget !== goal.target) patch.target = nextTarget;
                  if (iso(date) !== goal.targetDate) patch.targetDate = iso(date);
                  if (!Object.keys(patch).length) return setRevising(false);
                  const res = reviseGoal(goal.id, patch, reason.trim());
                  if (!res.ok) return setError(res.error);
                  setRevising(false);
                  refreshGoals();
                }}
              />
            </View>
          </Card>
        ) : goal.status === 'active' || goal.status === 'paused' ? (
          <GradientButton label={strings.goalChangeTarget} variant="secondary" onPress={startRevise} />
        ) : null}
        <DatePickerModal
          visible={picking !== null}
          date={picking === 'target' ? date : new Date()}
          onClose={() => setPicking(null)}
          onSelect={(d) => {
            if (picking === 'target') setDate(d);
            else if (picking === 'finished') {
              const res = recordEventFinished(goal.id, iso(d));
              if (res.ok) refreshGoals();
              else setError(res.error);
            }
            setPicking(null);
          }}
        />

        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{strings.goalShare}</Text>
              <Text style={styles.hint}>{strings.goalShareHint}</Text>
            </View>
            <Switch
              value={goal.visibility === 'shared'}
              onValueChange={(on) => setGoalVisibility(goal.id, on ? 'shared' : 'private')}
              accessibilityLabel={strings.goalShare}
              trackColor={{ true: colors.teal, false: colors.cardAlt }}
            />
          </View>
          {goal.visibility === 'shared' && reviews.length ? (
            <>
              <Text style={[styles.cardTitle, { marginTop: spacing.sm }]}>{strings.goalReviews}</Text>
              {reviews.map((r) => (
                <View key={r.id} style={styles.review}>
                  <Text style={styles.meta}>{`${r.author_name ?? strings.goalReviewAuthor} · ${day(Date.parse(r.created_at))}`}</Text>
                  <Text style={styles.body}>{r.body}</Text>
                </View>
              ))}
            </>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.goalHistory}</Text>
          <Text style={styles.body}>{`${day(goal.createdAt)} · ${strings.goalCreated}${goal.baseline ? ` (${strings.goalBaseline.toLowerCase()} ${value(goal.baseline.value)})` : ''}`}</Text>
          {goal.revisions.map((r, i) => (
            <View key={i}>
              <Text style={styles.body}>{`${day(r.at)} · ${describeChange(goal, r)}`}</Text>
              {r.reason ? <Text style={styles.hint}>{r.reason}</Text> : null}
            </View>
          ))}
          {goal.completedOn ? <Text style={styles.body}>{`${strings.goalFinishedOn} ${goal.completedOn}`}</Text> : null}
        </Card>

        <View style={styles.row}>
          {goal.status === 'active' ? <GradientButton label={strings.goalPause} variant="secondary" style={{ flex: 1 }} onPress={() => setGoalStatus(goal.id, 'paused')} /> : null}
          {goal.status === 'paused' || goal.status === 'abandoned' ? <GradientButton label={strings.goalResume} variant="secondary" style={{ flex: 1 }} onPress={() => setGoalStatus(goal.id, 'active')} /> : null}
          {goal.status === 'active' || goal.status === 'paused' ? <GradientButton label={strings.goalStop} variant="secondary" style={{ flex: 1 }} onPress={() => setGoalStatus(goal.id, 'abandoned')} /> : null}
        </View>
        <GradientButton
          label={strings.goalDelete}
          variant="tertiary"
          onPress={() => {
            removeGoal(goal.id);
            router.back();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  summary: { color: colors.text, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular, flexShrink: 1 },
  value: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  error: { color: colors.red, fontSize: 13, fontFamily: fontFamily.regular },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.teal },
  weeks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  week: { width: 44, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.cardAlt, alignItems: 'center' },
  weekMet: { backgroundColor: `${colors.teal}33` },
  weekCount: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  weekLabel: { color: colors.textTertiary, fontSize: 10.5, fontFamily: fontFamily.regular },
  review: { gap: 2, paddingTop: 4 },
});
