import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { diffWorkouts } from '@/lib/ai/diff';
import { newUuid } from '@/lib/id';
import { checkWorkout, limitsOn, withoutConflicts } from '@/lib/rehab/conflicts';
import { RULE_LABEL, TAG_LABEL } from '@/lib/rehab/model';
import { strings } from '@/lib/strings';
import { withFreshIds, type ScheduledWorkout, type WorkoutContent } from '@/lib/workout/model';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

const localDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Checks a planned workout against the training limits in force on its date
 * (clinician restrictions and the athlete's own notes). It warns and can
 * draft a version without the clashing exercises; it never blocks the
 * athlete and never changes the plan without their choice.
 */
export function ConflictBanner({ entry, content }: { entry: ScheduledWorkout; content: WorkoutContent }) {
  const clinical = useWorkoutsStore((s) => s.clinical);
  const episodes = useWorkoutsStore((s) => s.episodes);
  const applyAdaptation = useWorkoutsStore((s) => s.applyAdaptation);
  const [preview, setPreview] = useState(false);

  const check = useMemo(() => checkWorkout(content, limitsOn(localDate(entry.scheduledAt), clinical.restrictions, Object.values(episodes))), [content, entry.scheduledAt, clinical, episodes]);
  if (!check.conflicts.length && !check.unchecked.length) return null;
  const draft = check.conflicts.length ? withoutConflicts(content, check) : undefined;
  const changes = draft ? diffWorkouts(content, draft) : [];
  const advice = check.worst === 'avoid' ? strings.conflictAvoid : check.worst === 'review_required' ? strings.conflictReview : strings.conflictLimit;

  return (
    <Card style={[styles.card, check.worst === 'avoid' && styles.avoid]}>
      {check.conflicts.length ? (
        <>
          <Text style={styles.title}>{strings.conflictsTitle}</Text>
          <Text style={styles.advice}>{advice}</Text>
          {check.conflicts.map((c, i) => (
            <Text key={i} style={styles.line}>
              {`${c.stepName} · ${c.tags.map((t) => TAG_LABEL[t].toLowerCase()).join(', ')} · ${RULE_LABEL[c.limit.rule]}${c.limit.source === 'self' ? ' (your note)' : ''}`}
            </Text>
          ))}
        </>
      ) : null}
      {check.unchecked.length ? (
        <Text style={styles.hint}>{strings.conflictUnchecked(check.unchecked.map((u) => u.stepName).join(', '))}</Text>
      ) : null}
      {check.conflicts.length ? (
        draft ? (
          preview ? (
            <View style={{ gap: spacing.xs }}>
              {changes.map((c, i) => (
                <View key={i} style={styles.change}>
                  <Text style={styles.where}>{c.where}</Text>
                  {c.before ? <Text style={styles.before}>{c.before}</Text> : null}
                  {c.after ? <Text style={styles.after}>{c.after}</Text> : null}
                </View>
              ))}
              {/* A new version needs its own block and step ids: ids are unique on the server. */}
              <GradientButton label={strings.useThisVersion} variant="secondary" onPress={() => applyAdaptation(entry.id, withFreshIds(draft, newUuid))} />
            </View>
          ) : (
            <GradientButton label={strings.removeConflicting} variant="secondary" onPress={() => setPreview(true)} />
          )
        ) : (
          <Text style={styles.hint}>{strings.removeNothingLeft}</Text>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderColor: `${colors.amber}88` },
  avoid: { borderColor: `${colors.red}aa` },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  advice: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.semibold },
  line: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  change: { gap: 2, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  where: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.medium },
  before: { color: colors.textTertiary, fontSize: 13, textDecorationLine: 'line-through', fontFamily: fontFamily.regular },
  after: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
});
