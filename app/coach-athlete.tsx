import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CommentThread } from '@/components/coaching/CommentThread';
import { SharedGoals } from '@/components/goals/SharedGoals';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { Toast } from '@/components/ui/Toast';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { formatDateLabel } from '@/lib/date';
import { assignWorkout, cancelAssignment, getAssignmentOutcomes, listAssignments, type Assignment, type AssignmentOutcome } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { syncNow } from '@/lib/sync';
import { formatClock } from '@/lib/workout/format';
import { sessionDurationSeconds } from '@/lib/workout/scoring';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const STATUS: Record<Assignment['status'], string> = {
  pending: strings.statusPending,
  accepted: strings.statusAccepted,
  declined: strings.statusDeclined,
  cancelled: strings.statusCancelled,
};

/** One athlete from the coach's side: send a workout, see what happened to what was sent, talk about it. */
export default function CoachAthleteScreen() {
  const { athleteId, relationshipId } = useLocalSearchParams<{ athleteId: string; relationshipId: string }>();
  const workouts = useWorkoutsStore((s) => s.workouts);
  const versions = useWorkoutsStore((s) => s.versions);
  const [sent, setSent] = useState<Assignment[]>([]);
  const [outcomes, setOutcomes] = useState<{ planShared: boolean; sessionsShared: boolean; outcomes: AssignmentOutcome[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000));
  const [pickingDate, setPickingDate] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    const [a, o] = await Promise.all([listAssignments(), getAssignmentOutcomes(athleteId)]);
    if (a.ok) setSent(a.data.filter((x) => x.role === 'coach' && x.athlete_id === athleteId));
    else setToast(a.error);
    if (o.ok) setOutcomes(o.data);
  }, [athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Published workouts of the coach's own, templates first.
  const sendable = useMemo(
    () =>
      Object.values(workouts)
        .filter((w) => !w.deletedAt && versions[w.currentVersionId]?.status === 'published')
        .sort((a, b) => Number(b.isTemplate) - Number(a.isTemplate) || b.updatedAt - a.updatedAt)
        .slice(0, 30),
    [workouts, versions]
  );

  const send = async () => {
    const workout = picked ? workouts[picked] : undefined;
    if (!workout || busy) return;
    setBusy(true);
    await syncNow(); // the version must be on the server before it can be sent
    const res = await assignWorkout(relationshipId, workout.currentVersionId, date, message);
    setBusy(false);
    if (!res.ok) return setToast(res.error);
    setToast(strings.sent);
    setPicked(null);
    setMessage('');
    await load();
  };

  const name = sent[0]?.athlete_name ?? strings.coachingTitle;

  return (
    <View style={styles.screen}>
      <DetailHeader title={name} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <GradientButton label={strings.viewSharedData} variant="secondary" onPress={() => router.push({ pathname: '/shared-athlete', params: { athleteId } })} />

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.sendWorkout}</Text>
          <Text style={styles.body}>{strings.sendWorkoutBody}</Text>
          <Text style={styles.label}>{strings.chooseWorkout}</Text>
          {sendable.length === 0 ? <Text style={styles.body}>{strings.noWorkoutsToSend}</Text> : null}
          {sendable.map((w) => {
            const on = picked === w.id;
            return (
              <TouchableOpacity key={w.id} style={[styles.choice, on && styles.choiceOn]} onPress={() => setPicked(on ? null : w.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <Text style={styles.choiceText}>{versions[w.currentVersionId].content.title}</Text>
                {w.isTemplate ? <Text style={styles.meta}>{strings.template}</Text> : null}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.dateRow} onPress={() => setPickingDate(true)}>
            <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
            <Text style={styles.label}>{strings.sendOn}</Text>
            <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
          </TouchableOpacity>
          <DatePickerModal visible={pickingDate} date={date} onClose={() => setPickingDate(false)} onSelect={(d) => (setDate(d), setPickingDate(false))} />
          <FieldCard label={strings.messageOptional} value={message} onChangeText={setMessage} placeholder={strings.messagePlaceholder} maxLength={1000} cardStyle={styles.inset} />
          <GradientButton label={busy ? strings.saving : strings.send} onPress={picked && !busy ? () => void send() : undefined} />
        </Card>

        <Text style={styles.sectionTitle}>{strings.sentWorkouts}</Text>
        {outcomes && !outcomes.planShared && !outcomes.sessionsShared ? <Text style={styles.hint}>{strings.outcomeNotShared}</Text> : null}
        {sent.length === 0 ? <Text style={styles.body}>{strings.noneSent}</Text> : null}
        {sent.map((a) => {
          const outcome = outcomes?.outcomes.find((o) => o.assignment_id === a.id);
          const duration = outcome?.session ? sessionDurationSeconds(outcome.session) : undefined;
          return (
            <Card key={a.id} style={styles.card}>
              <View style={styles.rowHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.meta}>{`${formatDateLabel(new Date(a.scheduled_for))} · ${STATUS[a.status]}`}</Text>
                </View>
                {a.status === 'pending' ? (
                  <TouchableOpacity
                    onPress={async () => {
                      const res = await cancelAssignment(a.id);
                      if (!res.ok) setToast(res.error);
                      await load();
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.withdraw}>{strings.withdraw}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {a.message ? <Text style={styles.body}>{`“${a.message}”`}</Text> : null}
              {outcome?.scheduled_status ? (
                <Text style={styles.outcome}>
                  {outcome.scheduled_status === 'completed' ? strings.outcomeDone : outcome.scheduled_status === 'skipped' ? strings.outcomeSkipped : strings.outcomePlanned}
                  {outcome.session ? ` · ${[duration ? formatClock(duration) : undefined, outcome.session.rpe !== undefined ? `RPE ${outcome.session.rpe}` : undefined].filter(Boolean).join(' · ')}` : ''}
                </Text>
              ) : null}
              {outcome?.session?.notes ? <Text style={styles.body}>{outcome.session.notes}</Text> : null}
              <CommentThread assignmentId={a.id} comments={a.comments} canPost={a.status !== 'cancelled'} onPosted={() => void load()} onError={setToast} />
            </Card>
          );
        })}

        <SharedGoals athleteId={athleteId} onError={setToast} />
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  choiceOn: { borderColor: colors.teal, backgroundColor: `${colors.teal}18` },
  choiceText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginLeft: 'auto' },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  withdraw: { color: colors.red, fontSize: 13, fontFamily: fontFamily.semibold },
  outcome: { color: colors.teal, fontSize: 13.5, fontFamily: fontFamily.semibold },
});
