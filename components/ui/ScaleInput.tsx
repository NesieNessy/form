import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontFamily, radius, tabular } from '@/theme/colors';

/**
 * The app's one 0-10 scale: all eleven values fit in one row on any phone,
 * the chosen value is filled and bold, and screen readers hear a radio group.
 */
export function ScaleInput({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {Array.from({ length: 11 }, (_, i) => {
        const on = value === i;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.cell, on && styles.on]}
            onPress={() => onChange(i)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            aria-checked={on}
            accessibilityLabel={`${label}: ${i}`}
          >
            <Text style={[styles.text, on && styles.textOn]}>{i}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  cell: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  on: { backgroundColor: colors.action, borderColor: colors.action },
  text: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold, ...tabular },
  textOn: { color: colors.onAction, fontFamily: fontFamily.bold },
});
