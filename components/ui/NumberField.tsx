import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  label?: string;
  value: number | undefined;
  /** Called with undefined when the field is cleared: an empty field means "not recorded", not zero. */
  onChange: (value: number | undefined) => void;
  suffix?: string;
  decimals?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

const toText = (value: number | undefined) => (value === undefined ? '' : String(value));

export function NumberField({ label, value, onChange, suffix, decimals, placeholder = '–', style }: Props) {
  const [text, setText] = useState(() => toText(value));

  // Follow outside changes without clobbering what is being typed ("12." is still 12).
  useEffect(() => {
    setText((current) => (parse(current, decimals) === value ? current : toText(value)));
  }, [value, decimals]);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.box}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(next) => {
            const cleaned = clean(next, decimals);
            setText(cleaned);
            onChange(parse(cleaned, decimals));
          }}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          selectTextOnFocus
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function clean(raw: string, decimals?: boolean): string {
  const normalized = raw.replace(',', '.');
  if (!decimals) return normalized.replace(/[^0-9]/g, '');
  const [head, ...rest] = normalized.replace(/[^0-9.]/g, '').split('.');
  return rest.length ? `${head}.${rest.join('')}` : head;
}

function parse(text: string, decimals?: boolean): number | undefined {
  if (text === '' || text === '.') return undefined;
  const n = decimals ? Number.parseFloat(text) : Number.parseInt(text, 10);
  return Number.isFinite(n) ? n : undefined;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 4 },
  label: { color: colors.textSecondary, fontSize: 11.5, fontFamily: fontFamily.medium },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  input: { flex: 1, minWidth: 0, color: colors.text, fontSize: 15, fontFamily: fontFamily.bold, padding: 0 },
  suffix: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.medium },
});
