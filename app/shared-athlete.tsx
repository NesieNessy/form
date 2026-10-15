import { WEEKDAYS_SHORT } from '@/lib/i18n/tr';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { benchmarkTitle, currentBenchmarks, formatBenchmarkValue } from '@/lib/athlete/model';
import { formatDateLabel } from '@/lib/date';
import { getSharedContext, relationshipLabel, type SharedContext } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { formatScore } from '@/lib/workout/format';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/**
 * What one athlete shares with the signed-in professional. Only granted
 * categories exist in the response, so a section that is absent here was
 * never sent. Opening this screen is recorded in the athlete's access log.
 */
export default function SharedAthleteScreen() {
  const { athleteId } = useLocalSearchParams<{ athleteId: string }>();
  const [ctx, setCtx] = useState<SharedContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!athleteId) return;
    getSharedContext(athleteId).then((res) => {
      if (cancelled) return;
      if (res.ok) setCtx(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (error || !ctx) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.sharedDataTitle} />
        <View style={styles.centered}>
          <Text style={styles.muted}>{error ?? strings.loading}</Text>
        </View>
      </View>
    );
  }

  const benchmarks = ctx.benchmarks ? currentBenchmarks(ctx.benchmarks) : [];

  return (
    <View style={styles.screen}>
      <DetailHeader title={ctx.athlete.displayName} subtitle={strings.youAreTheir(relationshipLabel(ctx.relationshipType).toLowerCase())} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.body}>{ctx.granted.length === 0 ? strings.nothingSharedYet : strings.sharedViewNotice}</Text>
        </Card>

        {ctx.summary ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.last28Days}</Text>
            <View style={styles.chipRow}>
              <Chip label={strings.sessions} value={String(ctx.summary.sessions_completed)} />
              <Chip label={strings.plannedVsDone} value={`${ctx.summary.planned_workouts_completed}/${ctx.summary.workouts_planned}`} />
              <Chip
                label={strings.lastSession}
                value={ctx.summary.last_session_at ? formatDateLabel(new Date(ctx.summary.last_session_at)) : strings.notAvailable}
              />
            </View>
          </Card>
        ) : null}

        {ctx.profile ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.profileTitle}</Text>
            <Line label={strings.yourSports} value={ctx.profile.sports.join(', ') || strings.notSet} />
            <Line label={strings.yourEquipment} value={ctx.profile.equipment.join(', ') || strings.notSet} />
            <Line
              label={strings.usualTrainingDays}
              value={ctx.profile.availableDays.map((d) => WEEKDAYS_SHORT[d]).join(', ') || strings.notSet}
            />
            <Line label={strings.weeklyGoal} value={`${ctx.profile.weeklySessionTarget} ${strings.sessionsPerWeek}`} />
          </Card>
        ) : null}

        {ctx.benchmarks ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.benchmarks}</Text>
            {benchmarks.length === 0 ? <Text style={styles.muted}>{strings.noBenchmarksYet}</Text> : null}
            {benchmarks.map((b) => (
              <Line key={b.id} label={`${benchmarkTitle(b)} · ${b.measuredOn}`} value={formatBenchmarkValue(b)} />
            ))}
          </Card>
        ) : null}

        {ctx.sessions ? (
          <>
            <Text style={styles.sectionTitle}>{strings.completedSessions}</Text>
            {ctx.sessions.length === 0 ? <Text style={styles.muted}>{strings.noDataYet}</Text> : null}
            {ctx.sessions.map((session) => {
              const isOpen = open === session.id;
              const headline = session.blockResults.map((r) => formatScore(r.score)).filter((s) => s !== '—').join(' · ');
              return (
                <View key={session.id} style={{ gap: spacing.md }}>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setOpen(isOpen ? null : session.id)}>
                    <Card style={styles.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{session.prescribed.title}</Text>
                        <Text style={styles.muted}>
                          {formatDateLabel(new Date(session.startedAt))}
                          {headline ? ` · ${headline}` : ''}
                          {session.rpe !== undefined ? ` · RPE ${session.rpe}` : ''}
                        </Text>
                      </View>
                      {isOpen ? (
                        <Icons.chevronUp size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                      ) : (
                        <Icons.chevronDown size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                      )}
                    </Card>
                  </TouchableOpacity>
                  {isOpen ? (
                    <>
                      <WorkoutSummaryView content={session.prescribed} dateTimeMs={session.startedAt} blockResults={session.blockResults} />
                      {session.notes ? (
                        <Card>
                          <Text style={styles.cardTitle}>{strings.notes}</Text>
                          <Text style={styles.body}>{session.notes}</Text>
                        </Card>
                      ) : null}
                    </>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {ctx.plan ? (
          <>
            <Text style={styles.sectionTitle}>{strings.plannedWorkouts}</Text>
            {ctx.plan.length === 0 ? <Text style={styles.muted}>{strings.noDataYet}</Text> : null}
            {ctx.plan.map((entry) => {
              const key = `plan-${entry.id}`;
              const isOpen = open === key;
              return (
                <View key={key} style={{ gap: spacing.md }}>
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setOpen(isOpen ? null : key)}>
                    <Card style={styles.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{entry.version.content.title}</Text>
                        <Text style={styles.muted}>
                          {formatDateLabel(new Date(entry.scheduledAt))} · {entry.status === 'completed' ? strings.completed : entry.status === 'skipped' ? strings.didNotDo : strings.planned}
                        </Text>
                      </View>
                      {isOpen ? (
                        <Icons.chevronUp size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                      ) : (
                        <Icons.chevronDown size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                      )}
                    </Card>
                  </TouchableOpacity>
                  {isOpen ? <WorkoutSummaryView content={entry.version.content} dateTimeMs={entry.scheduledAt} /> : null}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  muted: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily.regular },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  chipLabel: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.medium },
  chipValue: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  lineLabel: { flexShrink: 1, color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  lineValue: { flexShrink: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
});
