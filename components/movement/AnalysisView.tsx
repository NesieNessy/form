import { SourceTag } from '@/components/ui/SourceTag';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import type { ClipAnalysis } from '@/lib/movement/api';
import { observationText } from '@/lib/movement/describe';
import { LIMITATIONS, NOT_A_DIAGNOSIS, OBSERVATION_TITLE } from '@/lib/movement/model';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s * 10) % 10)}`;

/** Observations with their confidence and the moments they refer to, or why the clip could not be assessed. */
export function AnalysisView({ analysis, onSeek }: { analysis: ClipAnalysis; onSeek?: (seconds: number) => void }) {
  const notes = analysis.limitations.filter((l) => analysis.usable || l === 'trimmed_to_60_seconds');
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{analysis.usable ? strings.observations : strings.cannotAssess}</Text>
      <SourceTag source="calculated" />
      {!analysis.usable ? (
        <>
          <Text style={styles.label}>{strings.whyNot}</Text>
          {analysis.limitations.map((l) => (
            <Text key={l} style={styles.body}>{`• ${LIMITATIONS[l] ?? l}`}</Text>
          ))}
        </>
      ) : (
        analysis.observations.map((o) => (
          <View key={o.label} style={styles.obs}>
            <View style={styles.row}>
              <Text style={styles.obsTitle}>{OBSERVATION_TITLE[o.label] ?? o.label}</Text>
              <Text style={styles.meta}>{strings.confidenceLabel[o.confidence]}</Text>
            </View>
            <Text style={styles.body}>{observationText(o)}</Text>
            {o.timestamps.length && o.label !== 'repetitions' ? (
              <View style={styles.wrap}>
                {o.timestamps.map((t) => (
                  <TouchableOpacity key={t} style={styles.chip} onPress={() => onSeek?.(Math.max(0, t - 1))} accessibilityLabel={strings.atTime(clock(t))}>
                    <Text style={styles.chipText}>{clock(t)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ))
      )}
      {analysis.usable && notes.length ? (
        <>
          <Text style={styles.label}>{strings.alsoNote}</Text>
          {notes.map((l) => (
            <Text key={l} style={styles.hint}>{`• ${LIMITATIONS[l] ?? l}`}</Text>
          ))}
        </>
      ) : null}
      <Text style={styles.hint}>{NOT_A_DIAGNOSIS}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium, marginTop: 4 },
  obs: { gap: 4, paddingVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  obsTitle: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.cardAlt },
  chipText: { color: colors.text, fontSize: 12, fontFamily: fontFamily.semibold },
});
