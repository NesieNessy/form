import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { formatDateLabel, formatTimeLabel } from '@/lib/date';
import { strings } from '@/lib/strings';
import type { ScheduleItem } from '@/lib/useWorkouts';
import { countExercises } from '@/lib/workout/model';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

function statusOf(item: ScheduleItem): { label: string; color: string } {
  if (item.version.status !== 'published') return { label: strings.needsFixing, color: colors.amber };
  if (item.entry.status === 'completed') return { label: strings.completed, color: colors.green };
  if (item.openSession) return { label: strings.inProgress, color: colors.orange };
  if (item.entry.status === 'skipped') return { label: strings.didNotDo, color: colors.textTertiary };
  return { label: strings.planned, color: colors.blue };
}

export function WorkoutCard({ item, showTime }: { item: ScheduleItem; showTime?: boolean }) {
  const exerciseCount = countExercises(item.version.content);
  const status = statusOf(item);
  const date = new Date(item.entry.scheduledAt);
  const done = item.entry.status === 'completed';
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={() => router.push(`/workout-detail?id=${item.entry.id}`)}>
      <Card style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${status.color}22` }]}>
          {done ? (
            <Icons.checkCircle size={20} color={status.color} strokeWidth={iconStrokeWidth} />
          ) : (
            <Icons.dumbbell size={20} color={status.color} strokeWidth={iconStrokeWidth} />
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {item.version.content.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {showTime ? formatTimeLabel(date) : formatDateLabel(date)}
            {exerciseCount > 0 ? ` · ${exerciseCount} ${exerciseCount === 1 ? strings.exercise : strings.exercisePlural}` : ''}
          </Text>
          <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
        </View>
        <Icons.chevronRight size={18} color={colors.textTertiary} />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  subtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
  status: { fontSize: 11.5, marginTop: 3, fontFamily: fontFamily.semibold },
});
