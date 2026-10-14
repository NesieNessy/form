import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GoalForm } from '@/components/goals/GoalForm';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { formatGoalValue, type Goal } from '@/lib/goals/model';
import { strings } from '@/lib/strings';
import { getWorkoutData, progressInputsOf, useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const STATUS_ORDER: Record<Goal['status'], number> = { active: 0, paused: 1, achieved: 2, abandoned: 3 };

export default function GoalsScreen() {
  const goals = useWorkoutsStore((s) => s.goals);
  const episodes = useWorkoutsStore((s) => s.episodes);
  const addGoal = useWorkoutsStore((s) => s.addGoal);
  const refreshGoals = useWorkoutsStore((s) => s.refreshGoals);
  const [adding, setAdding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshGoals();
    }, [refreshGoals])
  );

  const list = Object.values(goals)
    .filter((g) => !g.deletedAt)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.targetDate.localeCompare(b.targetDate));
  const openEpisodes = Object.values(episodes).filter((e) => !e.deletedAt && e.status !== 'resolved');

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.goalsTitle} subtitle={strings.goalsSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{strings.goalsHint}</Text>
        {list.length === 0 && !adding ? <Text style={styles.body}>{strings.noGoals}</Text> : null}
        {list.map((g) => {
          const pct = g.progress?.fraction !== undefined ? Math.round(Math.min(1, Math.max(0, g.progress.fraction)) * 100) : undefined;
          return (
            <TouchableOpacity key={g.id} activeOpacity={0.75} onPress={() => router.push({ pathname: '/goal', params: { id: g.id } })} accessibilityLabel={g.title}>
              <Card style={[styles.goal, g.status !== 'active' && styles.dim]}>
                <View style={styles.row}>
                  <Icons.target size={18} color={g.status === 'achieved' ? colors.teal : colors.textSecondary} strokeWidth={iconStrokeWidth} />
                  <Text style={styles.title} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={styles.meta}>{strings.goalStatus[g.status]}</Text>
                  <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                </View>
                <Text style={styles.meta}>
                  {[g.target !== undefined && g.metric.kind !== 'sessions_per_week' && g.metric.kind !== 'nutrition_logging' ? formatGoalValue(g.metric, g.target) : undefined, `by ${g.targetDate}`, g.visibility === 'shared' ? strings.goalShare.toLowerCase() : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {pct !== undefined ? (
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct}%` }]} />
                  </View>
                ) : null}
                {g.progress ? <Text style={styles.body}>{g.progress.summary}</Text> : null}
              </Card>
            </TouchableOpacity>
          );
        })}
        {adding ? (
          <GoalForm
            evidence={progressInputsOf(getWorkoutData(), Date.now())}
            episodes={openEpisodes}
            onCancel={() => setAdding(false)}
            onSave={(input) => {
              const res = addGoal(input);
              if (res.ok) {
                setAdding(false);
                refreshGoals();
                router.push({ pathname: '/goal', params: { id: res.goalId } });
              }
              return res;
            }}
          />
        ) : (
          <GradientButton label={strings.newGoal} icon={<Icons.plus size={16} color="#fff" strokeWidth={iconStrokeWidth} />} onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  goal: { gap: 6 },
  dim: { opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.teal },
});
