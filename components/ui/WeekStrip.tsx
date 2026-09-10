import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radius } from '@/theme/colors';

type Day = { day: string; date: number; done: boolean; today?: boolean };

export function WeekStrip({ days }: { days: Day[] }) {
  return (
    <View style={styles.row}>
      {days.map((d) => (
        <View key={d.date} style={styles.col}>
          <Text style={styles.dayLabel}>{d.day}</Text>
          <View style={[styles.dot, d.today && styles.dotToday, d.done && !d.today && styles.dotDone]}>
            <Text style={[styles.dateLabel, d.today && styles.dateLabelToday]}>{d.date}</Text>
          </View>
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
    gap: 8,
  },
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
    backgroundColor: 'rgba(61,220,132,0.16)',
  },
  dotToday: {
    backgroundColor: colors.blue,
  },
  dateLabel: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
  },
  dateLabelToday: {
    color: '#fff',
    fontFamily: fontFamily.bold,
  },
});
