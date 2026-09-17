import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  visible: boolean;
  date: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(monthStart: Date): Date[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
  );
}

export function DatePickerModal({ visible, date, onClose, onSelect }: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));

  useEffect(() => {
    if (visible) setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [visible, date]);

  const today = new Date();
  const days = buildMonthGrid(viewMonth);
  const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const goMonth = (delta: number) => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
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
              const selected = isSameDay(d, date);
              const isToday = isSameDay(d, today);
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={styles.dayCell}
                  activeOpacity={0.7}
                  onPress={() => onSelect(d)}
                >
                  <View style={[styles.dayInner, selected && styles.daySelected, !selected && isToday && styles.dayToday]}>
                    <Text
                      style={[styles.dayLabel, !inMonth && styles.dayLabelMuted, selected && styles.dayLabelSelected]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
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
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.blue },
  dayToday: { borderWidth: 1, borderColor: colors.borderStrong },
  dayLabel: { color: colors.text, fontSize: 13, fontFamily: fontFamily.medium },
  dayLabelMuted: { color: colors.textTertiary },
  dayLabelSelected: { color: '#fff', fontFamily: fontFamily.bold },
});
