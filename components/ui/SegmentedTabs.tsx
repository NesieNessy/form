import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Option = { key: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  scrollable?: boolean;
  size?: 'sm' | 'md';
};

export function SegmentedTabs({ options, value, onChange, scrollable, size = 'md' }: Props) {
  const content = (
    <View style={[styles.row, scrollable && { paddingRight: spacing.screenX }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.pill,
              size === 'sm' && styles.pillSm,
              active ? styles.pillActive : styles.pillInactive,
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.label,
                size === 'sm' && styles.labelSm,
                active ? styles.labelActive : styles.labelInactive,
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {content}
      </ScrollView>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  pillSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillActive: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pillInactive: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
  },
  labelSm: {
    fontSize: 12,
  },
  labelActive: {
    color: colors.text,
  },
  labelInactive: {
    color: colors.textTertiary,
  },
});
