import { Minus, Plus } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};

export function Stepper({ value, onChange, min = 0, max = Infinity, step = 1, suffix }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.7}
        onPress={() => onChange(clamp(value - step))}
        hitSlop={8}
      >
        <Minus size={16} color={colors.text} strokeWidth={iconStrokeWidth} />
      </TouchableOpacity>
      <Text style={styles.value}>
        {value}
        {suffix ? ` ${suffix}` : ''}
      </Text>
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.7}
        onPress={() => onChange(clamp(value + step))}
        hitSlop={8}
      >
        <Plus size={16} color={colors.text} strokeWidth={iconStrokeWidth} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  btn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
});
