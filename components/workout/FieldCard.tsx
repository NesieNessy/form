import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, fontFamily, spacing } from '@/theme/colors';

type Props = TextInputProps & {
  label: string;
};

export function FieldCard({ label, style, ...rest }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, style]}
        {...rest}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fontFamily.medium,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fontFamily.semibold,
    padding: 0,
  },
});
