import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Provenance } from '@/lib/provenance';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const ICON: Record<Provenance, typeof Icons.activity> = {
  measurement: Icons.ruler,
  device: Icons.activity,
  self: Icons.pencil,
  calculated: Icons.hash,
  estimate: Icons.pencil,
  ai: Icons.sparkles,
  clinician: Icons.heartPulse,
};

/** Where a value came from: an icon and words, never colour alone. */
export function SourceTag({ source }: { source: Provenance }) {
  const Icon = ICON[source];
  const label = strings.sourceTag[source];
  return (
    <View style={styles.tag} accessibilityLabel={label}>
      <Icon size={12} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.medium },
});
