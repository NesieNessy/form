import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { activityLine, activityTitle, formatActivityDate, formatDistance, formatDuration } from '@/lib/health/format';
import { duplicateCandidates, matchCandidates } from '@/lib/health/logic';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

const STATUS_TEXT: Record<string, string> = {
  linked: strings.statusLinked,
  standalone: strings.statusStandalone,
  duplicate: strings.statusDuplicate,
  ignored: strings.statusIgnored,
};

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activities = useWorkoutsStore((s) => s.activities);
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const versions = useWorkoutsStore((s) => s.versions);
  const sessions = useWorkoutsStore((s) => s.sessions);
  const linkActivity = useWorkoutsStore((s) => s.linkActivity);
  const logActivityAsWorkout = useWorkoutsStore((s) => s.logActivityAsWorkout);
  const setActivityStatus = useWorkoutsStore((s) => s.setActivityStatus);
  const removeActivity = useWorkoutsStore((s) => s.removeActivity);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const activity = activities[id];
  const live = activity && !activity.deletedAt ? activity : undefined;

  const duplicates = useMemo(
    () => (live?.status === 'new' ? duplicateCandidates(live, Object.values(activities).filter((a) => !a.deletedAt)) : []),
    [live, activities]
  );
  const matches = useMemo(
    () => (live?.status === 'new' ? matchCandidates(live, Object.values(scheduled), versions) : []),
    [live, scheduled, versions]
  );

  if (!live) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.activityFallbackName} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>{strings.activityNotFound}</Text>
        </View>
      </View>
    );
  }

  const scheduledId = live.sessionId ? sessions[live.sessionId]?.scheduledWorkoutId : undefined;
  const openWorkout = (entryId: string) => router.replace({ pathname: '/workout-detail', params: { id: entryId } });

  const stats: [string, string | undefined][] = [
    [strings.activityDuration, formatDuration(live.elapsedSeconds)],
    [strings.activityMoving, live.movingSeconds !== undefined && live.movingSeconds < live.elapsedSeconds - 30 ? formatDuration(live.movingSeconds) : undefined],
    [strings.activityDistance, live.distanceMeters ? formatDistance(live.distanceMeters) : undefined],
    [strings.activityClimb, live.elevationGainMeters ? `${Math.round(live.elevationGainMeters)} m` : undefined],
    [strings.activityAvgHr, live.avgHeartRate ? `${Math.round(live.avgHeartRate)} bpm` : undefined],
    [strings.activityMaxHr, live.maxHeartRate ? `${Math.round(live.maxHeartRate)} bpm` : undefined],
    [strings.activityPower, live.avgPowerWatts ? `${Math.round(live.avgPowerWatts)} W` : undefined],
    [strings.activityCalories, live.caloriesEstimate ? String(Math.round(live.caloriesEstimate)) : undefined],
  ];

  return (
    <View style={styles.screen}>
      <DetailHeader title={activityTitle(live)} subtitle={formatActivityDate(live.startedAt)} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.stats}>
            {stats
              .filter(([, value]) => value !== undefined)
              .map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <Text style={styles.statLabel}>{label}</Text>
                  <Text style={styles.statValue}>{value}</Text>
                </View>
              ))}
          </View>
          <Text style={styles.meta}>{strings.activitySource(live.source.format ?? live.provider,live.source.device ?? live.source.creator)}</Text>
        </Card>

        {live.quality.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.qualityNotes}</Text>
            {live.quality.map((q) => (
              <Text key={q} style={styles.body}>{`• ${strings.quality[q] ?? q}`}</Text>
            ))}
          </Card>
        ) : null}

        {live.status !== 'new' ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{STATUS_TEXT[live.status]}</Text>
            {scheduledId ? <GradientButton label={strings.openWorkout} onPress={() => openWorkout(scheduledId)} /> : null}
            {live.status === 'duplicate' || live.status === 'ignored' ? (
              <GradientButton label={strings.undoDecision} variant="secondary" onPress={() => setActivityStatus(live.id, 'new')} />
            ) : null}
          </Card>
        ) : (
          <>
            {duplicates.map((other) => (
              <Card key={other.id} style={[styles.card, styles.warn]}>
                <Text style={styles.cardTitle}>{strings.maybeSameEffort}</Text>
                <Text style={styles.body}>{strings.maybeSameEffortHint}</Text>
                <Text style={styles.meta}>{`${activityTitle(other)} · ${formatActivityDate(other.startedAt)} · ${activityLine(other)}`}</Text>
                <GradientButton label={strings.markAsDuplicate} variant="secondary" onPress={() => setActivityStatus(live.id, 'duplicate', other.id)} />
              </Card>
            ))}

            {matches.length ? <Text style={styles.sectionTitle}>{strings.plannedThatDay}</Text> : null}
            {matches.map((m) => (
              <Card key={m.entry.id} style={styles.card}>
                <View style={styles.matchHead}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{m.version.content.title}</Text>
                  {m.confidence === 'likely' ? <Text style={styles.likely}>{strings.likelyMatch}</Text> : null}
                </View>
                <Text style={styles.meta}>{`${formatActivityDate(m.entry.scheduledAt)} · ${m.reason}`}</Text>
                <GradientButton
                  label={strings.recordAsResult}
                  variant={m.confidence === 'likely' ? 'primary' : 'secondary'}
                  onPress={() => {
                    linkActivity(live.id, m.entry.id);
                    openWorkout(m.entry.id);
                  }}
                />
              </Card>
            ))}

            <GradientButton
              label={strings.logAsWorkout}
              variant={matches.length ? 'secondary' : 'primary'}
              onPress={() => {
                logActivityAsWorkout(live.id);
                const after = useWorkoutsStore.getState();
                const sessionId = after.activities[live.id]?.sessionId;
                const entryId = sessionId ? after.sessions[sessionId]?.scheduledWorkoutId : undefined;
                if (entryId) openWorkout(entryId);
              }}
            />
            <GradientButton label={strings.ignoreActivity} variant="tertiary" onPress={() => setActivityStatus(live.id, 'ignored')} />
          </>
        )}

        {confirmingDelete ? (
          <Card style={styles.card}>
            <Text style={styles.body}>{strings.confirmDeleteActivity}</Text>
            <View style={styles.confirmRow}>
              <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmingDelete(false)} />
              <GradientButton
                label={strings.deleteWorkout}
                colorsOverride={[colors.red, colors.red]}
                style={{ flex: 1 }}
                onPress={() => {
                  removeActivity(live.id);
                  router.back();
                }}
              />
            </View>
          </Card>
        ) : (
          <GradientButton label={strings.deleteActivity} variant="tertiary" onPress={() => setConfirmingDelete(true)} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  missingText: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.regular },
  card: { gap: spacing.sm },
  warn: { borderColor: `${colors.amber}88` },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  meta: { color: colors.textTertiary, fontSize: 12.5, fontFamily: fontFamily.regular },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  stat: { width: '50%' },
  statLabel: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.medium },
  statValue: { color: colors.text, fontSize: 18, fontFamily: fontFamily.bold, marginTop: 2 },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  likely: { color: colors.teal, fontSize: 12, fontFamily: fontFamily.semibold },
  confirmRow: { flexDirection: 'row', gap: spacing.md },
});
