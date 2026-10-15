import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { s } from '@/components/studio/styles';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { Toast } from '@/components/ui/Toast';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { bookClass, cancelBooking, cancelClass, classRoster, classWorkout, listClasses, markAttendance } from '@/lib/studio/api';
import { bookingAction, type RosterRow, type StudioClass } from '@/lib/studio/model';
import { locale, strings, timeLocale } from '@/lib/strings';
import type { WorkoutVersion } from '@/lib/workout/model';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, spacing } from '@/theme/colors';

const DAY = 86_400_000;

/** One class: details and booking for members; roster and check-in for its instructor and the studio's managers. */
export default function StudioClassScreen() {
  const { id, org } = useLocalSearchParams<{ id: string; org: string }>();
  const addFromCoach = useWorkoutsStore((st) => st.addFromCoach);
  const [klass, setKlass] = useState<StudioClass | null>(null);
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [workout, setWorkout] = useState<WorkoutVersion | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    const res = await listClasses(org, new Date(Date.now() - 30 * DAY), new Date(Date.now() + 30 * DAY));
    if (!res.ok) return setToast(res.error);
    const c = res.data.find((x) => x.id === id) ?? null;
    setKlass(c);
    if (c?.can_manage) {
      const r = await classRoster(c.id);
      if (r.ok) setRoster(r.data);
    }
    if (c?.has_workout && (c.can_manage || c.my_booking?.status === 'booked')) {
      const w = await classWorkout(c.id);
      if (w.ok) setWorkout(w.data);
    } else setWorkout(null);
  }, [id, org]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!klass) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.tabClasses} />
      </View>
    );
  }

  const start = new Date(klass.starts_at);
  const action = bookingAction(klass, Date.now());
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setToast(res.error ?? '');
    await load();
  };

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={klass.title}
        subtitle={`${start.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' })}, ${start.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}–${new Date(klass.ends_at).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}`}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={s.card}>
          <Text style={s.body}>
            {[klass.facility, klass.instructor_name ? strings.withInstructor(klass.instructor_name) : undefined, `${klass.booked}/${klass.capacity}`, klass.status === 'cancelled' ? strings.classCancelled : undefined]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {klass.description ? <Text style={s.body}>{klass.description}</Text> : null}
          {klass.my_booking ? <Text style={s.value}>{klass.my_booking.status === 'booked' ? strings.youAreBooked : strings.onWaitlist(klass.my_booking.waitlist_position)}</Text> : null}
          {!klass.can_manage && action !== 'started' && action !== 'cancelled' ? (
            <GradientButton
              label={busy ? strings.saving : { book: strings.book, join_waitlist: strings.joinWaitlist, cancel: strings.cancelBooking, leave_waitlist: strings.leaveWaitlist }[action]}
              variant={action === 'book' ? 'primary' : 'secondary'}
              onPress={() => void run(() => (action === 'book' || action === 'join_waitlist' ? bookClass(klass.id) : cancelBooking(klass.id)))}
            />
          ) : null}
        </Card>

        {workout ? (
          <Card style={s.card}>
            <WorkoutSummaryView content={workout.content} />
            {klass.my_booking?.status === 'booked' ? (
              <GradientButton
                label={strings.addClassWorkout}
                variant="secondary"
                onPress={() => {
                  addFromCoach(workout.content, start.getTime());
                  setToast(strings.classWorkoutAdded);
                }}
              />
            ) : null}
          </Card>
        ) : null}

        {roster ? (
          <Card style={s.card}>
            <Text style={s.title}>{strings.roster}</Text>
            <Text style={s.hint}>{strings.rosterNote}</Text>
            {roster.length === 0 ? <Text style={s.body}>{strings.rosterNone}</Text> : null}
            {roster.map((r) => (
              <View key={r.booking_id} style={s.row}>
                <Text style={[s.body, { flex: 1 }]}>{`${r.name ?? strings.someone}${r.status === 'waitlisted' ? ` · ${strings.onWaitlist(null)}` : ''}`}</Text>
                {r.status === 'booked' ? (
                  <TouchableOpacity
                    style={[s.pill, r.attended === true && { backgroundColor: `${colors.teal}44` }]}
                    onPress={() => void run(() => markAttendance(r.booking_id, r.attended !== true))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: r.attended === true }}
                    accessibilityLabel={`${strings.checkIn}: ${r.name ?? ''}`}
                  >
                    <Text style={s.pillText}>{r.attended === true ? strings.attended : r.attended === false ? strings.noShow : strings.checkIn}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {klass.can_manage && klass.status === 'scheduled' && action !== 'started' ? (
          <GradientButton
            label={strings.cancelClass}
            variant="tertiary"
            onPress={() =>
              void run(async () => {
                const res = await cancelClass(klass.id);
                if (res.ok) router.back();
                return res;
              })
            }
          />
        ) : null}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
});
