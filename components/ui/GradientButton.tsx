import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, fontFamily, radius } from '@/theme/colors';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  colorsOverride?: readonly [string, string, ...string[]];
  /**
   * primary: FORM gradient, for the one key action on a screen.
   * secondary: dark card + border, for supporting actions.
   * tertiary: text/icon only, for low-emphasis actions.
   */
  variant?: 'primary' | 'secondary' | 'tertiary';
};

export function GradientButton({ label, onPress, icon, colorsOverride, variant = 'primary' }: Props) {
  if (variant === 'tertiary') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.tertiary}>
        {icon}
        <Text style={styles.tertiaryLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.secondary}>
        {icon}
        <Text style={styles.secondaryLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={colorsOverride ?? colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primary}
      >
        {icon}
        <Text style={styles.primaryLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radius.button,
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: radius.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fontFamily.semibold,
  },
  tertiary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  tertiaryLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
  },
});
