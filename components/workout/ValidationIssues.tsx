import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { strings } from '@/lib/strings';
import type { ValidationResult } from '@/lib/workout/validate';
import { colors, fontFamily, spacing } from '@/theme/colors';

/** Errors block saving; warnings are shown but leave the decision to the athlete. */
export function ValidationIssues({ result }: { result: ValidationResult }) {
  if (result.errors.length === 0 && result.warnings.length === 0) return null;
  return (
    <View style={{ gap: spacing.md }}>
      {result.errors.length > 0 ? (
        <Card style={[styles.card, { borderColor: colors.red }]}>
          <Text style={[styles.heading, { color: colors.red }]}>{strings.fixBeforeSaving}</Text>
          {result.errors.map((issue, i) => (
            <Text key={`${issue.code}-${i}`} style={styles.line}>
              • {issue.message}
            </Text>
          ))}
        </Card>
      ) : null}
      {result.warnings.length > 0 ? (
        <Card style={[styles.card, { borderColor: colors.amber }]}>
          <Text style={[styles.heading, { color: colors.amber }]}>{strings.worthASecondLook}</Text>
          {result.warnings.map((issue, i) => (
            <Text key={`${issue.code}-${i}`} style={styles.line}>
              • {issue.message}
            </Text>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  heading: { fontSize: 13, fontFamily: fontFamily.bold, marginBottom: 2 },
  line: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
});
