import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { buildMonthGrid, isSameDay, startOfDayMs } from '@/lib/date';
import type { ScheduleItem } from '@/lib/useWorkouts';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = {
  items: ScheduleItem[];
  selected: Date;
  onSelect: (date: Date) => void;
};

/** Month grid with one marker per day: planned (outline) and completed (filled). */
export function MonthCalendar({ items, selected, onSelect }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  const today = new Date();
  const days = buildMonthGrid(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goMonth = (delta: number) => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  const marks = useMemo(() => {
    const byDay = new Map<number, { planned: boolean; done: boolean }>();
    for (const item of items) {
      const key = startOfDayMs(item.entry.scheduledAt);
      const mark = byDay.get(key) ?? { planned: false, done: false };
      if (item.entry.status === 'completed') mark.done = true;
      else if (item.entry.status === 'planned') mark.planned = true;
      byDay.set(key, mark);
    }
    return byDay;
  }, [items]);

  return (
    <Card>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={10} style={styles.navBtn}>
          <Icons.chevronLeft size={18} color={colors.text} strokeWidth={iconStrokeWidth} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => goMonth(1)} hitSlop={10} style={styles.navBtn}>
          <Icons.chevronRight size={18} color={colors.text} strokeWidth={iconStrokeWidth} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={i} style={styles.weekLabel}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((d) => {
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const isSelected = isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          const mark = marks.get(d.getTime());
          return (
            <TouchableOpacity key={d.toISOString()} style={styles.dayCell} activeOpacity={0.7} onPress={() => onSelect(d)}>
              <View style={[styles.dayInner, isSelected && styles.daySelected, !isSelected && isToday && styles.dayToday]}>
                <Text style={[styles.dayLabel, !inMonth && styles.dayLabelMuted, isSelected && styles.dayLabelSelected]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={styles.markRow}>
                {mark?.done ? <View style={[styles.mark, styles.markDone]} /> : null}
                {mark?.planned ? <View style={[styles.mark, styles.markPlanned]} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
  },
  monthLabel: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  weekRow: { flexDirection: 'row' },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 11.5,
    fontFamily: fontFamily.medium,
    marginBottom: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.blue },
  dayToday: { borderWidth: 1, borderColor: colors.borderStrong },
  dayLabel: { color: colors.text, fontSize: 13, fontFamily: fontFamily.medium },
  dayLabelMuted: { color: colors.textTertiary },
  dayLabelSelected: { color: '#fff', fontFamily: fontFamily.bold },
  markRow: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  mark: { width: 6, height: 6, borderRadius: 3 },
  markDone: { backgroundColor: colors.green },
  markPlanned: { borderWidth: 1, borderColor: colors.blue },
});
