import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { colors, fontFamily, spacing } from '@/theme/colors';

type Props = {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  children?: React.ReactNode;
};

export function RadioRow({ label, hint, selected, onPress, children }: Props) {
  return (
    <Card style={styles.card}>
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
        <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{label}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      </TouchableOpacity>
      {selected && children ? <View style={styles.content}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.blue },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
  label: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  hint: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  content: { marginTop: spacing.md },
});
