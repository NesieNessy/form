import { LinearGradient } from 'expo-linear-gradient';
import { Infinity as InfinityIcon, Repeat, Shuffle, Timer, Zap } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { strings } from '@/lib/strings';
import type { WorkoutType } from '@/lib/types';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';

type Option = { key: WorkoutType; label: string; icon: typeof Repeat };

const OPTIONS: Option[] = [
  { key: 'emom', label: strings.workoutTypeEmom, icon: Repeat },
  { key: 'amrap', label: strings.workoutTypeAmrap, icon: InfinityIcon },
  { key: 'forTime', label: strings.workoutTypeForTime, icon: Timer },
  { key: 'tabata', label: strings.workoutTypeTabata, icon: Zap },
  { key: 'mix', label: strings.workoutTypeMix, icon: Shuffle },
];

type Props = {
  value: WorkoutType;
  onChange: (type: WorkoutType) => void;
};

export function WorkoutTypeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {OPTIONS.map((opt) => {
          const active = opt.key === value;
          const Icon = opt.icon;
          if (active) {
            return (
              <TouchableOpacity key={opt.key} onPress={() => onChange(opt.key)} activeOpacity={0.85}>
                <LinearGradient
                  colors={colors.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.pillActiveBorder}
                >
                  <View style={styles.pillActiveInner}>
                    <Icon size={15} color={colors.text} strokeWidth={iconStrokeWidth} />
                    <Text style={styles.labelActive}>{opt.label}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.8}
              style={[styles.pill, styles.pillInactive]}
            >
              <Icon size={15} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
              <Text style={styles.labelInactive}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.screenX },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  pillInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActiveBorder: {
    borderRadius: radius.pill,
    padding: 1.5,
  },
  pillActiveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7.5,
    paddingHorizontal: 12.5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgElevated,
  },
  labelActive: { color: colors.text, fontSize: 13, fontFamily: fontFamily.bold },
  labelInactive: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
});
