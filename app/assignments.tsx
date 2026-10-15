import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CommentThread } from '@/components/coaching/CommentThread';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { Toast } from '@/components/ui/Toast';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { useAuthStore } from '@/lib/auth';
import { formatDateLabel } from '@/lib/date';
import { decideAssignment, listAssignments, type Assignment } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { syncNow } from '@/lib/sync';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const STATUS: Record<Assignment['status'], string> = {
  pending: strings.statusPending,
  accepted: strings.statusAccepted,
  declined: strings.statusDeclined,
  cancelled: strings.statusCancelled,
};

/** Workouts coaches sent to the athlete. Nothing reaches the calendar until it is accepted here. */
export default function AssignmentsScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [items, setItems] = useState<Assignment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    if (!signedIn) return;
    const res = await listAssignments();
    if (res.ok) setItems(res.data.filter((a) => a.role === 'athlete'));
    else setToast(res.error);
    setLoaded(true);
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const pending = items.filter((a) => a.status === 'pending');
  const earlier = items.filter((a) => a.status !== 'pending');

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.fromCoachTitle} subtitle={strings.fromCoachSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!signedIn ? (
          <Card>
            <Text style={styles.body}>{strings.fromCoachNeedsAccount}</Text>
          </Card>
        ) : null}
        {signedIn && loaded && items.length === 0 ? <Text style={styles.body}>{strings.fromCoachEmpty}</Text> : null}
        {pending.map((a) => (
          <PendingCard key={a.id} assignment={a} onDone={(msg) => (setToast(msg), void load())} onError={setToast} />
        ))}
        {earlier.length ? <Text style={styles.sectionTitle}>{strings.earlier}</Text> : null}
        {earlier.map((a) => (
          <Card key={a.id} style={styles.card}>
            <Text style={styles.cardTitle}>{a.title}</Text>
            <Text style={styles.meta}>{`${strings.sentBy(a.coach_name ?? strings.someone)} · ${STATUS[a.status]}`}</Text>
            <CommentThread assignmentId={a.id} comments={a.comments} canPost={a.status === 'accepted'} onPosted={() => void load()} onError={setToast} />
          </Card>
        ))}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

function PendingCard({ assignment: a, onDone, onError }: { assignment: Assignment; onDone: (message: string) => void; onError: (message: string) => void }) {
  const addFromCoach = useWorkoutsStore((s) => s.addFromCoach);
  const removeScheduled = useWorkoutsStore((s) => s.removeScheduled);
  const [date, setDate] = useState(() => {
    const d = new Date(a.scheduled_for);
    return d.getTime() < Date.now() ? new Date() : d;
  });
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    // The copy goes into the athlete's own calendar first; if the server refuses the decision, it is taken out again.
    const at = new Date(date);
    const sent = new Date(a.scheduled_for);
    at.setHours(sent.getHours(), sent.getMinutes(), 0, 0);
    const scheduledId = addFromCoach(a.version.content, at.getTime());
    const res = await decideAssignment(a.id, 'accepted', scheduledId);
    setBusy(false);
    if (!res.ok) {
      removeScheduled(scheduledId);
      return onError(res.error);
    }
    void syncNow();
    onDone(strings.accepted);
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    const res = await decideAssignment(a.id, 'declined');
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onDone(strings.declined);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.meta}>{strings.sentBy(a.coach_name ?? strings.someone)}</Text>
      {a.message ? <Text style={styles.body}>{`“${a.message}”`}</Text> : null}
      <WorkoutSummaryView content={a.version.content} dateTimeMs={new Date(a.scheduled_for).getTime()} />
      <TouchableOpacity style={styles.dateRow} onPress={() => setPicking(true)}>
        <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <Text style={styles.label}>{strings.addToCalendarOn}</Text>
        <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
      </TouchableOpacity>
      <DatePickerModal visible={picking} date={date} onClose={() => setPicking(false)} onSelect={(d) => (setDate(d), setPicking(false))} />
      <View style={styles.row}>
        <GradientButton label={strings.declineWorkout} variant="secondary" style={{ flex: 1 }} onPress={() => void decline()} />
        <GradientButton label={strings.acceptWorkout} style={{ flex: 1 }} onPress={() => void accept()} />
      </View>
      <CommentThread assignmentId={a.id} comments={a.comments} canPost onPosted={() => onDone('')} onError={onError} />
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginLeft: 'auto' },
  row: { flexDirection: 'row', gap: spacing.md },
});
