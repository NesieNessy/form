import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { bookClass, cancelBooking, listClasses } from '@/lib/studio/api';
import { bookingAction, byDay, teaches, type Organization, type StudioClass } from '@/lib/studio/model';
import { locale, strings, timeLocale } from '@/lib/strings';
import { ScheduleClassForm } from './ScheduleClassForm';
import { s } from './styles';

const DAY = 86_400_000;
const time = (iso: string) => new Date(iso).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' });
const dayLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
};

/** The next four weeks of a studio's timetable, with booking for members and scheduling for staff who teach. */
export function ClassList({ org, onToast }: { org: Organization; onToast: (m: string) => void }) {
  const [items, setItems] = useState<StudioClass[] | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const now = Date.now();
    const res = await listClasses(org.id, new Date(now - 2 * 3_600_000), new Date(now + 28 * DAY));
    if (res.ok) setItems(res.data);
    else onToast(res.error);
  }, [org.id, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (c: StudioClass) => {
    const action = bookingAction(c, Date.now());
    if (busy || action === 'started' || action === 'cancelled') return;
    setBusy(c.id);
    const res = action === 'book' || action === 'join_waitlist' ? await bookClass(c.id) : await cancelBooking(c.id);
    setBusy(null);
    if (!res.ok) onToast(res.error);
    await load();
  };

  const label = (c: StudioClass) =>
    ({ book: strings.book, join_waitlist: strings.joinWaitlist, cancel: strings.cancelBooking, leave_waitlist: strings.leaveWaitlist, started: strings.classStarted, cancelled: strings.classCancelled })[
      bookingAction(c, Date.now())
    ];

  return (
    <View style={{ gap: 8 }}>
      {teaches(org.role) ? (
        scheduling ? (
          <ScheduleClassForm
            org={org}
            onDone={(n) => {
              setScheduling(false);
              if (n) onToast(strings.classScheduled(n));
              void load();
            }}
            onToast={onToast}
          />
        ) : (
          <GradientButton label={strings.scheduleClass} variant="secondary" onPress={() => setScheduling(true)} />
        )
      ) : null}
      {items && items.length === 0 ? <Text style={s.body}>{strings.noClasses}</Text> : null}
      {byDay(items ?? []).map(({ day, items: list }) => (
        <View key={day} style={{ gap: 8 }}>
          <Text style={s.day}>{dayLabel(day)}</Text>
          {list.map((c) => {
            const left = c.capacity - c.booked;
            const state =
              c.status === 'cancelled'
                ? strings.classCancelled
                : c.my_booking?.status === 'booked'
                  ? strings.youAreBooked
                  : c.my_booking?.status === 'waitlisted'
                    ? strings.onWaitlist(c.my_booking.waitlist_position)
                    : left > 0
                      ? strings.placesLeft(left)
                      : strings.classFull;
            const action = bookingAction(c, Date.now());
            return (
              <TouchableOpacity key={c.id} activeOpacity={0.75} onPress={() => router.push({ pathname: '/studio-class', params: { id: c.id, org: org.id } })} accessibilityLabel={`${c.title} ${time(c.starts_at)}`}>
                <Card style={[s.card, c.status === 'cancelled' && { opacity: 0.6 }]}>
                  <View style={s.row}>
                    <Text style={s.value}>{`${time(c.starts_at)}–${time(c.ends_at)}`}</Text>
                    <Text style={[s.title, { flex: 1 }]} numberOfLines={1}>
                      {c.title}
                    </Text>
                  </View>
                  <Text style={s.meta}>{[c.facility, c.instructor_name ? strings.withInstructor(c.instructor_name) : undefined, state].filter(Boolean).join(' · ')}</Text>
                  {org.role === 'member' || !c.can_manage ? (
                    action === 'started' || action === 'cancelled' ? null : (
                      <GradientButton label={busy === c.id ? strings.saving : label(c)} variant={action === 'book' ? 'primary' : 'secondary'} onPress={() => void act(c)} accessibilityLabel={`${label(c)}: ${c.title}`} />
                    )
                  ) : (
                    <Text style={s.hint}>{`${c.booked}/${c.capacity}${c.waitlisted ? ` · +${c.waitlisted}` : ''}`}</Text>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
