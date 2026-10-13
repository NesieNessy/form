import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Option<K extends string | number> = { key: K; label: string };

type Props<K extends string | number> = {
  options: Option<K>[];
  selected: K[];
  onToggle: (key: K) => void;
};

/** A wrap of pills where any number can be on. For one-of-many use SegmentedTabs. */
export function ChipSelect<K extends string | number>({ options, selected, onToggle }: Props<K>) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const on = selected.includes(opt.key);
        return (
          <TouchableOpacity
            key={String(opt.key)}
            onPress={() => onToggle(opt.key)}
            activeOpacity={0.8}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: `${colors.blue}22`, borderColor: colors.blue },
  label: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
  labelOn: { color: colors.text },
});
