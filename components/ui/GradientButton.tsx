import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius } from '@/theme/colors';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  colorsOverride?: readonly [string, string, ...string[]];
};

export function GradientButton({ label, onPress, icon, colorsOverride }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={colorsOverride ?? colors.ctaGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        {icon}
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.md,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
