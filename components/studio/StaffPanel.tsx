import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { TimePickerModal } from '@/components/workout/TimePickerModal';
import { formatDateLabel } from '@/lib/date';
import { addShift, listShifts, removeShift } from '@/lib/studio/api';
import { isAdmin, isStaff, type Organization, type People, type Shift } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { colors, iconStrokeWidth } from '@/theme/colors';
import { Icons } from '@/theme/icons';
import { s } from './styles';

const DAY = 86_400_000;
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/** Staff shifts for the next two weeks; owners and managers plan them. */
export function StaffPanel({ org, people, onToast }: { org: Organization; people: People | null; onToast: (m: string) => void }) {
  const admin = isAdmin(org.role);
  const staff = (people?.people ?? []).filter((p) => isStaff(p.role));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [who, setWho] = useState('');
  const [start, setStart] = useState(() => {
    const d = new Date(Date.now() + DAY);
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [hours, setHours] = useState<number | undefined>(4);
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState<'date' | 'time' | null>(null);

  const load = useCallback(async () => {
    const res = await listShifts(org.id, new Date(Date.now() - DAY), new Date(Date.now() + 14 * DAY));
    if (res.ok) setShifts(res.data);
    else onToast(res.error);
  }, [org.id, onToast]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!who && staff[0]) setWho(staff[0].user_id);
  }, [who, staff]);

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.section}>{strings.shifts}</Text>
      {shifts.length === 0 ? <Text style={s.body}>{strings.noShifts}</Text> : null}
      {shifts.map((x) => (
        <Card key={x.id} style={s.card}>
          <View style={s.row}>
            <Text style={[s.title, { flex: 1 }]}>{x.mine ? strings.you : (x.name ?? strings.someone)}</Text>
            {admin ? (
              <TouchableOpacity onPress={() => void removeShift(x.id).then((r) => (r.ok ? load() : onToast(r.error)))} hitSlop={8}>
                <Text style={s.danger}>{strings.remove}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={s.meta}>{[`${when(x.starts_at)}–${new Date(x.ends_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, x.facility, x.note].filter(Boolean).join(' · ')}</Text>
        </Card>
      ))}
      {admin && staff.length ? (
        <Card style={s.card}>
          <Text style={s.title}>{strings.addShift}</Text>
          <Text style={s.label}>{strings.shiftFor}</Text>
          <SegmentedTabs options={staff.map((p) => ({ key: p.user_id, label: p.name ?? strings.someone }))} value={who} onChange={setWho} scrollable size="sm" />
          <TouchableOpacity style={s.dateRow} onPress={() => setPicking('date')}>
            <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
            <Text style={s.label}>{strings.shiftStarts}</Text>
            <Text style={s.dateValue}>{`${formatDateLabel(start)}, ${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.dateRow} onPress={() => setPicking('time')}>
            <Icons.clock size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
            <Text style={s.label}>{strings.time}</Text>
          </TouchableOpacity>
          <DatePickerModal visible={picking === 'date'} date={start} onClose={() => setPicking(null)} onSelect={(d) => (setStart(new Date(d.getFullYear(), d.getMonth(), d.getDate(), start.getHours(), start.getMinutes())), setPicking(null))} />
          <TimePickerModal visible={picking === 'time'} time={start} onClose={() => setPicking(null)} onSelect={(t) => (setStart(new Date(start.getFullYear(), start.getMonth(), start.getDate(), t.getHours(), t.getMinutes())), setPicking(null))} />
          <NumberField label={strings.shiftHours} value={hours} onChange={setHours} decimals />
          <FieldCard label={strings.shiftNote} value={note} onChangeText={setNote} maxLength={200} cardStyle={s.inset} />
          <GradientButton
            label={strings.addShift}
            variant="secondary"
            onPress={
              who && hours
                ? async () => {
                    const res = await addShift(org.id, who, org.facilities[0]?.id ?? null, start, new Date(start.getTime() + hours * 3_600_000), note);
                    if (!res.ok) return onToast(res.error);
                    setNote('');
                    await load();
                  }
                : undefined
            }
          />
        </Card>
      ) : null}
    </View>
  );
}
