import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, radius } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Day = { day: string; date: number; done: boolean; today?: boolean };

export function WeekStrip({ days }: { days: Day[] }) {
  return (
    <View style={styles.row}>
      {days.map((d) => (
        <View key={d.date} style={styles.col} accessible accessibilityLabel={[d.day, d.date, d.today ? strings.today : '', d.done ? strings.completed : ''].filter(Boolean).join(', ')}>
          <Text style={styles.dayLabel}>{d.day}</Text>
          <View style={[styles.dot, d.today && styles.dotToday, d.done && !d.today && styles.dotDone]}>
            <Text style={[styles.dateLabel, d.today && styles.dateLabelToday]}>{d.date}</Text>
          </View>
          {/* A finished day is marked by a check as well as by colour. */}
          <View style={styles.checkSlot}>{d.done ? <Icons.checkCircle size={12} color={colors.green} strokeWidth={iconStrokeWidth} /> : null}</View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    alignItems: 'center',
    gap: 6,
  },
  checkSlot: { height: 12, alignItems: 'center', justifyContent: 'center' },
  dayLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fontFamily.semibold,
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  dotDone: {
    backgroundColor: `${colors.green}29`,
  },
  dotToday: {
    backgroundColor: colors.action,
  },
  dateLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
  },
  dateLabelToday: {
    color: colors.onAction,
    fontFamily: fontFamily.bold,
  },
});
