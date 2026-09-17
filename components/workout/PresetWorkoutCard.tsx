import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { strings } from '@/lib/strings';
import type { SectionWorkoutType } from '@/lib/types';
import type { WorkoutPreset } from '@/lib/workoutPresets';
import { formatSectionHeadline } from '@/lib/workoutFormat';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const TYPE_ACCENT: Record<SectionWorkoutType, string> = {
  forTime: colors.blue,
  amrap: colors.orange,
  emom: colors.purple,
  tabata: colors.green,
  strength: colors.blue,
  partnerWod: colors.blue,
  custom: colors.blue,
};

const TYPE_LABEL: Record<SectionWorkoutType, string> = {
  forTime: strings.workoutTypeForTime,
  amrap: strings.workoutTypeAmrap,
  emom: strings.workoutTypeEmom,
  tabata: strings.workoutTypeTabata,
  strength: strings.strength,
  partnerWod: strings.workoutTypePartnerWod,
  custom: strings.workoutTypeCustom,
};

type Props = {
  preset: WorkoutPreset;
  favorited: boolean;
  onToggleFavorite: () => void;
  onPrevious: () => void;
  onShare: () => void;
  onEdit: () => void;
  onStub: (message: string) => void;
};

export function PresetWorkoutCard({ preset, favorited, onToggleFavorite, onPrevious, onShare, onEdit, onStub }: Props) {
  const workoutType = preset.section.workoutType ?? 'forTime';
  const accent = TYPE_ACCENT[workoutType];
  const headline = formatSectionHeadline(preset.section);

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onToggleFavorite} hitSlop={8}>
          <Icons.heart
            size={20}
            color={favorited ? colors.red : colors.textSecondary}
            fill={favorited ? colors.red : 'none'}
            strokeWidth={iconStrokeWidth}
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onStub(strings.comingSoon)} hitSlop={8}>
          <Icons.moreHorizontal size={20} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.typeLabel, { color: accent }]}>{TYPE_LABEL[workoutType]}</Text>
      <View style={styles.divider} />

      {headline ? <Text style={styles.headline}>{headline}</Text> : null}
      <View style={{ gap: 6 }}>
        {preset.section.exercises.map((exercise) => (
          <Text key={exercise.id} style={styles.exerciseLine}>
            {exercise.name}
          </Text>
        ))}
      </View>
      {preset.note ? <Text style={styles.note}>{preset.note}</Text> : null}

      <View style={styles.divider} />
      <GradientButton
        label={strings.startWorkout}
        colorsOverride={[accent, accent]}
        onPress={() => onStub(strings.comingSoon)}
      />

      <View style={styles.actionRow}>
        <ActionButton icon={Icons.rotateCcw} label={strings.back} onPress={onPrevious} />
        <ActionButton icon={Icons.video} label={strings.videos} onPress={() => onStub(strings.comingSoon)} />
        <ActionButton icon={Icons.share} label={strings.share} onPress={onShare} />
        <ActionButton icon={Icons.pencil} label={strings.edit} onPress={onEdit} />
      </View>
    </Card>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.actionIconWrap}>
        <Icon size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeLabel: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.xs,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  headline: {
    color: colors.text,
    fontSize: 13.5,
    fontFamily: fontFamily.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  exerciseLine: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.medium, textAlign: 'center' },
  note: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.regular, marginTop: spacing.sm, lineHeight: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.sm },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.textTertiary, fontSize: 11, fontFamily: fontFamily.medium },
});
