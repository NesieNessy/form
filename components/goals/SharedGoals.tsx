import { progressText } from '@/lib/goals/describe';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { FieldCard } from '@/components/workout/FieldCard';
import { formatGoalValue, type Goal } from '@/lib/goals/model';
import { addGoalReview, listSharedGoals, type GoalReview } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

const habit = (g: Goal) => g.metric.kind === 'sessions_per_week' || g.metric.kind === 'nutrition_logging';

/** A connected athlete's shared goals for their coach, with review comments. Each load is logged for the athlete. */
export function SharedGoals({ athleteId, onError }: { athleteId: string; onError: (message: string) => void }) {
  const [state, setState] = useState<{ shared: boolean; goals: { goal: Goal; reviews: GoalReview[] }[] } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listSharedGoals(athleteId);
    if (res.ok) setState(res.data);
  }, [athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!state) return null;
  return (
    <>
      <Text style={styles.sectionTitle}>{strings.coachGoals}</Text>
      {!state.shared ? <Text style={styles.hint}>{strings.coachGoalsNotShared}</Text> : state.goals.length === 0 ? <Text style={styles.body}>{strings.coachGoalsNone}</Text> : null}
      {state.goals.map(({ goal: g, reviews }) => {
        const pct = g.progress?.fraction !== undefined ? Math.round(Math.min(1, Math.max(0, g.progress.fraction)) * 100) : undefined;
        const draft = drafts[g.id] ?? '';
        return (
          <Card key={g.id} style={styles.card}>
            <Text style={styles.cardTitle}>{g.title}</Text>
            <Text style={styles.meta}>
              {[strings.goalStatus[g.status], g.target !== undefined ? (habit(g) ? String(g.target) : formatGoalValue(g.metric, g.target)) : undefined, `by ${g.targetDate}`].filter(Boolean).join(' · ')}
            </Text>
            {pct !== undefined ? (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
            ) : null}
            {g.progress ? <Text style={styles.body}>{progressText(g)}</Text> : null}
            {g.revisions.length ? <Text style={styles.hint}>{`${strings.goalHistory}: ${g.revisions.length}`}</Text> : null}
            {reviews.map((r) => (
              <View key={r.id} style={styles.review}>
                <Text style={styles.meta}>{r.by_me ? strings.you : (r.author_name ?? strings.someone)}</Text>
                <Text style={styles.body}>{r.body}</Text>
              </View>
            ))}
            <FieldCard
              label={strings.goalReviews}
              value={draft}
              onChangeText={(t) => setDrafts((d) => ({ ...d, [g.id]: t }))}
              placeholder={strings.goalReviewPlaceholder}
              maxLength={2000}
              multiline
              cardStyle={styles.inset}
            />
            <GradientButton
              label={busy === g.id ? strings.saving : strings.send}
              variant="secondary"
              onPress={
                draft.trim() && !busy
                  ? async () => {
                      setBusy(g.id);
                      const res = await addGoalReview(g.id, draft);
                      setBusy(null);
                      if (!res.ok) return onError(res.error);
                      setDrafts((d) => ({ ...d, [g.id]: '' }));
                      await load();
                    }
                  : undefined
              }
            />
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.teal },
  review: { gap: 2 },
});
