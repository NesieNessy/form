import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import { formatExerciseTarget } from '@/lib/workoutFormat';
import type { Exercise } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  index: number;
  exercise: Exercise;
  onPress: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove: () => void;
};

export function ExerciseRow({ index, exercise, onPress, onMoveUp, onMoveDown, onRemove }: Props) {
  return (
    <Card style={styles.card}>
      <TouchableOpacity style={styles.body} activeOpacity={0.7} onPress={onPress}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{exercise.name || strings.exerciseNumbered(index + 1)}</Text>
          <Text style={styles.meta}>{formatExerciseTarget(exercise)}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onMoveUp} disabled={!onMoveUp} hitSlop={6} style={styles.actionBtn}>
          <Icons.chevronUp size={16} color={onMoveUp ? colors.textSecondary : colors.textTertiary} strokeWidth={iconStrokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onMoveDown} disabled={!onMoveDown} hitSlop={6} style={styles.actionBtn}>
          <Icons.chevronDown size={16} color={onMoveDown ? colors.textSecondary : colors.textTertiary} strokeWidth={iconStrokeWidth} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove} hitSlop={6} style={styles.actionBtn}>
          <Icons.trash size={15} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.textSecondary, fontSize: 11.5, fontFamily: fontFamily.bold },
  name: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 1, fontFamily: fontFamily.regular },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
