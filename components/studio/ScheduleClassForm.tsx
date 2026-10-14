import React, { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { TimePickerModal } from '@/components/workout/TimePickerModal';
import { useAuthStore } from '@/lib/auth';
import { formatDateLabel } from '@/lib/date';
import { scheduleClasses, studioPeople } from '@/lib/studio/api';
import { isAdmin, isStaff, seriesStarts, type Organization } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { syncNow } from '@/lib/sync';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, iconStrokeWidth } from '@/theme/colors';
import { Icons } from '@/theme/icons';
import { s } from './styles';

const NONE = '__none';

/** Schedules one class or a weekly series. Instructors schedule their own; managers choose anyone on the staff. */
export function ScheduleClassForm({ org, onDone, onToast }: { org: Organization; onDone: (scheduled: number) => void; onToast: (m: string) => void }) {
  const me = useAuthStore((st) => st.userId);
  const workouts = useWorkoutsStore((st) => st.workouts);
  const versions = useWorkoutsStore((st) => st.versions);
  const admin = isAdmin(org.role);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(() => {
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [picking, setPicking] = useState<'date' | 'time' | null>(null);
  const [minutes, setMinutes] = useState<number | undefined>(60);
  const [capacity, setCapacity] = useState<number | undefined>(12);
  const [weeks, setWeeks] = useState<number | undefined>(1);
  const [facility, setFacility] = useState(org.facilities[0]?.id ?? NONE);
  const [instructor, setInstructor] = useState<string>(admin ? NONE : (me ?? NONE));
  const [staff, setStaff] = useState<{ key: string; label: string }[]>([]);
  const [workout, setWorkout] = useState(NONE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!admin) return;
    void studioPeople(org.id).then((res) => {
      if (res.ok) setStaff(res.data.people.filter((p) => isStaff(p.role)).map((p) => ({ key: p.user_id, label: p.user_id === me ? strings.you : (p.name ?? strings.someone) })));
    });
  }, [admin, org.id, me]);

  const published = useMemo(
    () =>
      Object.values(workouts)
        .filter((w) => !w.deletedAt && versions[w.currentVersionId]?.status === 'published')
        .sort((a, b) => Number(b.isTemplate) - Number(a.isTemplate) || b.updatedAt - a.updatedAt)
        .slice(0, 20),
    [workouts, versions]
  );
  const dates = seriesStarts(start, weeks ?? 1).map((d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

  const save = async () => {
    if (busy || !title.trim()) return;
    setBusy(true);
    const w = workout !== NONE ? workouts[workout] : undefined;
    if (w) await syncNow(); // the version must be on the server first
    const res = await scheduleClasses(org.id, {
      facilityId: facility === NONE ? null : facility,
      title,
      description,
      instructorId: instructor === NONE ? null : instructor,
      firstStart: start,
      minutes: minutes ?? 0,
      capacity: capacity ?? 0,
      weeks: weeks ?? 1,
      versionId: w?.currentVersionId ?? null,
    });
    setBusy(false);
    if (!res.ok) return onToast(res.error);
    onDone(res.data.class_ids.length);
  };

  return (
    <Card style={s.card}>
      <Text style={s.title}>{strings.scheduleClass}</Text>
      <FieldCard label={strings.classTitle} value={title} onChangeText={setTitle} maxLength={80} cardStyle={s.inset} />
      <FieldCard label={strings.classDescription} value={description} onChangeText={setDescription} maxLength={1000} cardStyle={s.inset} />
      <TouchableOpacity style={s.dateRow} onPress={() => setPicking('date')}>
        <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <Text style={s.label}>{strings.classStartsOn}</Text>
        <Text style={s.dateValue}>{formatDateLabel(start)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.dateRow} onPress={() => setPicking('time')}>
        <Icons.clock size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <Text style={s.label}>{strings.time}</Text>
        <Text style={s.dateValue}>{start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
      </TouchableOpacity>
      <DatePickerModal
        visible={picking === 'date'}
        date={start}
        onClose={() => setPicking(null)}
        onSelect={(d) => (setStart(new Date(d.getFullYear(), d.getMonth(), d.getDate(), start.getHours(), start.getMinutes())), setPicking(null))}
      />
      <TimePickerModal
        visible={picking === 'time'}
        time={start}
        onClose={() => setPicking(null)}
        onSelect={(t) => (setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate(), t.getHours(), t.getMinutes())), setPicking(null))}
      />
      <View style={s.row}>
        <NumberField label={strings.classMinutes} value={minutes} onChange={setMinutes} style={{ flex: 1 }} />
        <NumberField label={strings.classCapacity} value={capacity} onChange={setCapacity} style={{ flex: 1 }} />
        <NumberField label={strings.classWeeks} value={weeks} onChange={setWeeks} style={{ flex: 1 }} />
      </View>
      <Text style={s.hint}>{strings.classDates(dates.join(', '))}</Text>
      {org.facilities.length > 1 ? <SegmentedTabs options={org.facilities.map((f) => ({ key: f.id, label: f.name }))} value={facility} onChange={setFacility} scrollable size="sm" /> : null}
      {admin ? (
        <>
          <Text style={s.label}>{strings.classInstructor}</Text>
          <SegmentedTabs options={[{ key: NONE, label: strings.noInstructor }, ...staff]} value={instructor} onChange={setInstructor} scrollable size="sm" />
        </>
      ) : null}
      <Text style={s.label}>{strings.classWorkout}</Text>
      <SegmentedTabs options={[{ key: NONE, label: strings.noClassWorkout }, ...published.map((w) => ({ key: w.id, label: versions[w.currentVersionId].content.title }))]} value={workout} onChange={setWorkout} scrollable size="sm" />
      <View style={s.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => onDone(0)} />
        <GradientButton label={busy ? strings.saving : strings.schedule} style={{ flex: 1 }} onPress={title.trim() && !busy ? () => void save() : undefined} />
      </View>
    </Card>
  );
}
