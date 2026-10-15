import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { studioReport } from '@/lib/studio/api';
import { percent, reportCell, type Report } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { s } from './styles';

const DAY = 86_400_000;

/** Owners and managers: operations over twelve weeks, with small groups hidden. */
export function ReportPanel({ orgId, onToast }: { orgId: string; onToast: (m: string) => void }) {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    void studioReport(orgId, new Date(Date.now() - 56 * DAY), new Date(Date.now() + 28 * DAY)).then((res) => (res.ok ? setReport(res.data) : onToast(res.error)));
  }, [orgId, onToast]);

  if (!report) return null;
  const k = report.min_group_size;
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.section}>{strings.reportTitle}</Text>
      <Text style={s.hint}>{strings.reportNote(k)}</Text>
      <Card style={s.card}>
        {report.weeks.map((w) => (
          <View key={w.week_start} style={{ gap: 2 }}>
            <Text style={s.value}>{`${strings.reportWeek} ${w.week_start}`}</Text>
            <Text style={s.body}>
              {[
                `${w.classes} ${strings.reportClasses}${w.cancelled ? ` (+${w.cancelled} ${strings.classCancelled.toLowerCase()})` : ''}`,
                `${reportCell(w.bookings, w.suppressed, k)} ${strings.reportBookings}`,
                `${reportCell(w.attended, w.suppressed, k)} ${strings.reportAttended}`,
                `${reportCell(w.people, w.suppressed, k)} ${strings.reportPeople}`,
              ].join(' · ')}
            </Text>
          </View>
        ))}
      </Card>
      <Card style={s.card}>
        {report.classes.map((c) => (
          <View key={c.title} style={s.row}>
            <Text style={[s.body, { flex: 1 }]}>{`${c.title} · ${c.sessions}×`}</Text>
            <Text style={s.value}>{c.suppressed ? reportCell(null, true, k) : `${percent(c.occupancy)} ${strings.reportOccupancy} · ${percent(c.attendance_rate)} ${strings.reportAttendance}`}</Text>
          </View>
        ))}
      </Card>
      <Card style={s.card}>
        {report.memberships.map((m) => (
          <View key={m.plan} style={s.row}>
            <Text style={[s.body, { flex: 1 }]}>{m.plan}</Text>
            <Text style={s.value}>{`${reportCell(m.active, m.suppressed, k)} ${strings.reportActive}`}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
