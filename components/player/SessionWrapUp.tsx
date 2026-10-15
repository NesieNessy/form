import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  rpe: number | undefined;
  onRpeChange: (rpe: number | undefined) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
};

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const NOTES_MAX = 300;

/** Optional subjective effort and a note, recorded with the finished session. */
export function SessionWrapUp({ rpe, onRpeChange, notes, onNotesChange }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{strings.howDidItFeel}</Text>
      <Text style={styles.label}>
        {strings.effortRpe} · {strings.optional}
      </Text>
      <View style={styles.rpeRow}>
        {RPE_VALUES.map((value) => {
          const active = rpe === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => onRpeChange(active ? undefined : value)}
              style={[styles.rpe, active && styles.rpeActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${strings.effortRpe} ${value}`}
            >
              <Text style={[styles.rpeLabel, active && styles.rpeLabelActive]}>{value}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={styles.notes}
        value={notes}
        onChangeText={(v) => onNotesChange(v.slice(0, NOTES_MAX))}
        placeholder={strings.sessionNotesPlaceholder}
        placeholderTextColor={colors.textTertiary}
        multiline
        maxLength={NOTES_MAX}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rpe: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeActive: { backgroundColor: colors.action },
  rpeLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
  rpeLabelActive: { color: colors.onAction, fontFamily: fontFamily.bold },
  notes: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    padding: spacing.md,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
});
