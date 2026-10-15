import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SourceTag } from '@/components/ui/SourceTag';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** Where an assistant draft stands (docs/concepts/11-frontend-ux-ui-architecture.md, section 8.4). */
export type DraftState = 'working' | 'needs_clarification' | 'validation_issues' | 'awaiting_approval' | 'applied' | 'failed' | 'closed';

const ICON: Record<Exclude<DraftState, 'working'>, typeof Icons.info> = {
  needs_clarification: Icons.info,
  validation_issues: Icons.info,
  awaiting_approval: Icons.clock,
  applied: Icons.checkCircle,
  failed: Icons.info,
  closed: Icons.minus,
};

/**
 * The same header on every assistant draft: that it is an AI draft, its
 * state in words and an icon (never colour alone), and that nothing is
 * saved without approval. "Saved" is shown only once it really is.
 */
export function DraftStatus({ state }: { state: DraftState }) {
  const tone = state === 'applied' ? colors.success : state === 'awaiting_approval' || state === 'working' ? colors.info : state === 'closed' ? colors.textTertiary : colors.warning;
  const Icon = state === 'working' ? null : ICON[state];
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.chip, { borderColor: tone }]} accessibilityRole="text" accessibilityLabel={strings.draftState[state]}>
          {Icon ? <Icon size={14} color={tone} strokeWidth={iconStrokeWidth} /> : <ActivityIndicator size="small" color={tone} />}
          <Text style={[styles.chipText, { color: tone }]}>{strings.draftState[state]}</Text>
        </View>
        <SourceTag source="ai" />
      </View>
      {state !== 'applied' && state !== 'closed' ? <Text style={styles.hint}>{strings.proposalSubtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontFamily: fontFamily.semibold },
  hint: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
});
