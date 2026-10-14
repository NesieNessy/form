import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
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
  style?: StyleProp<ViewStyle>;
  /** For screen readers when the visible label alone is ambiguous (e.g. several "Choose" buttons). */
  accessibilityLabel?: string;
};

export function GradientButton({ label, onPress, icon, colorsOverride, variant = 'primary', style, accessibilityLabel }: Props) {
  const a11y = { accessibilityRole: 'button' as const, accessibilityLabel: accessibilityLabel ?? label };
  if (variant === 'tertiary') {
    return (
      <TouchableOpacity {...a11y} onPress={onPress} activeOpacity={0.7} style={[styles.tertiary, style]}>
        {icon}
        <Text style={styles.tertiaryLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity {...a11y} onPress={onPress} activeOpacity={0.85} style={[styles.secondary, style]}>
        {icon}
        <Text style={styles.secondaryLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity {...a11y} onPress={onPress} activeOpacity={0.85} style={style}>
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
    paddingHorizontal: 24,
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
