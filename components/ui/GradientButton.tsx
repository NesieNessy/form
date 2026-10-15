import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, fontFamily, radius, touch } from '@/theme/colors';

type Props = {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  /**
   * primary: solid action colour, for the one key action on a screen.
   * secondary: surface with a border, for supporting actions.
   * tertiary: text only, for low-emphasis actions.
   * danger: solid danger colour, for destructive actions only.
   */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  /** Without an onPress the button is shown and announced as unavailable. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** For screen readers when the visible label alone is ambiguous (e.g. several "Choose" buttons). */
  accessibilityLabel?: string;
};

/**
 * The app's button. The name is historical: the brand gradient is kept for
 * the logo and rare brand moments (docs/concepts/12-form-brand-design-system.md),
 * and buttons are solid.
 */
export function GradientButton({ label, onPress, icon, variant = 'primary', disabled, style, accessibilityLabel }: Props) {
  const off = disabled ?? !onPress;
  const a11y = { accessibilityRole: 'button' as const, accessibilityLabel: accessibilityLabel ?? label, accessibilityState: { disabled: off } };
  const box = variant === 'primary' ? styles.primary : variant === 'danger' ? styles.danger : variant === 'secondary' ? styles.secondary : styles.tertiary;
  const text = variant === 'primary' || variant === 'danger' ? styles.solidLabel : variant === 'secondary' ? styles.secondaryLabel : styles.tertiaryLabel;
  return (
    <TouchableOpacity {...a11y} onPress={off ? undefined : onPress} disabled={off} activeOpacity={0.8} style={[box, off && styles.off, style]}>
      {icon}
      <Text style={text}>{label}</Text>
    </TouchableOpacity>
  );
}

const base = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, minHeight: touch.min + 4, paddingHorizontal: 20, borderRadius: radius.button };

const styles = StyleSheet.create({
  primary: { ...base, backgroundColor: colors.action },
  danger: { ...base, backgroundColor: colors.danger },
  secondary: { ...base, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong },
  tertiary: { ...base, minHeight: touch.min, paddingHorizontal: 8 },
  off: { opacity: 0.45 },
  solidLabel: { color: colors.onAction, fontSize: 15, fontFamily: fontFamily.bold },
  secondaryLabel: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold },
  tertiaryLabel: { color: colors.action, fontSize: 14, fontFamily: fontFamily.semibold },
});
