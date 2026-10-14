import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { Toast } from '@/components/ui/Toast';
import { ValidationIssues } from '@/components/workout/ValidationIssues';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { useAuthStore } from '@/lib/auth';
import { localDateOf } from '@/lib/health/model';
import { entryAmount, entryName } from '@/lib/nutrition/format';
import { formatNutrient } from '@/lib/nutrition/model';
import { strings } from '@/lib/strings';
import { useScheduleItem } from '@/lib/useWorkouts';
import { formatClock, formatKg } from '@/lib/workout/format';
import { sessionDurationSeconds, sessionVolumeKg } from '@/lib/workout/scoring';
import { formatWorkoutShareText } from '@/lib/workout/share';
import { validateWorkout } from '@/lib/workout/validate';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useScheduleItem(id);
  const startSession = useWorkoutsStore((s) => s.startSession);
  const setTemplate = useWorkoutsStore((s) => s.setTemplate);
  const removeScheduled = useWorkoutsStore((s) => s.removeScheduled);
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const activities = useWorkoutsStore((s) => s.activities);
  const foodLog = useWorkoutsStore((s) => s.foodLog);
  const hideEnergy = useWorkoutsStore((s) => !!s.profile.hideEnergy);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!item) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.workoutFallbackTitle} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>{strings.workoutNotFound}</Text>
        </View>
      </View>
    );
  }

  const { entry, workout, version, session, openSession } = item;
  const content = version.content;
  const published = version.status === 'published';

  const open = (mode: 'player' | 'manual') => {
    const res = startSession(entry.id, mode);
    if ('error' in res) return;
    // Resuming goes back to whichever way the session was started.
    const resumedMode = openSession?.entryMode ?? mode;
    router.push({ pathname: resumedMode === 'player' ? '/workout-player' : '/workout-log', params: { sessionId: res.sessionId, from: 'detail' } });
  };

  const recording =
    session?.entryMode === 'import' ? Object.values(activities).find((a) => a.sessionId === session.id && !a.deletedAt) : undefined;
  const fuel = session ? Object.values(foodLog).filter((e) => e.sessionId === session.id && !e.deletedAt).sort((a, b) => a.consumedAt - b.consumedAt) : [];
  const duration = session ? sessionDurationSeconds(session) : undefined;
  const volume = session ? sessionVolumeKg(session) : 0;

  return (
    <View style={styles.screen}>
      <DetailHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {published ? null : (
          <>
            <Card>
              <Text style={styles.draftNote}>{strings.draftCannotStart}</Text>
            </Card>
            <ValidationIssues result={validateWorkout(content)} />
          </>
        )}

        <WorkoutSummaryView content={content} dateTimeMs={entry.scheduledAt} blockResults={session?.blockResults} />

        {session ? (
          <Card style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>{strings.results}</Text>
            <View style={styles.chipRow}>
              {duration !== undefined ? <Chip label={strings.totalTime} value={formatClock(duration)} /> : null}
              {volume > 0 ? <Chip label={strings.volume} value={formatKg(Math.round(volume))} /> : null}
              {session.rpe !== undefined ? <Chip label={strings.effortRpe} value={String(session.rpe)} /> : null}
            </View>
            {session.notes ? <Text style={styles.resultNotes}>{session.notes}</Text> : null}
            <View style={styles.fuel}>
              <Text style={styles.resultsTitle}>{strings.fuelTitle}</Text>
              {fuel.length === 0 ? <Text style={styles.resultNotes}>{strings.noFuelYet}</Text> : null}
              {fuel.map((e) => {
                const key = hideEnergy ? 'carbohydrate_g' : 'energy_kcal';
                const v = e.nutrients[key];
                return (
                  <Text key={e.id} style={styles.resultNotes} onPress={() => router.push({ pathname: '/nutrition-add', params: { entryId: e.id } })}>
                    {[entryName(e), entryAmount(e), typeof v === 'number' ? formatNutrient(key, v) : undefined].filter(Boolean).join(' · ')}
                  </Text>
                );
              })}
              <GradientButton
                label={strings.logFuel}
                variant="tertiary"
                onPress={() => router.push({ pathname: '/nutrition-add', params: { sessionId: session.id, date: localDateOf(session.startedAt) } })}
              />
            </View>
            {recording ? (
              <GradientButton label={strings.viewRecording} variant="tertiary" onPress={() => router.push({ pathname: '/activity', params: { id: recording.id } })} />
            ) : null}
          </Card>
        ) : null}

        {published && !session ? (
          openSession ? (
            <GradientButton label={strings.resumeWorkout} onPress={() => open(openSession.entryMode === 'player' ? 'player' : 'manual')} />
          ) : (
            <>
              <GradientButton label={strings.startWorkout} onPress={() => open('player')} />
              <GradientButton label={strings.logResults} variant="secondary" onPress={() => open('manual')} />
              {signedIn ? (
                <GradientButton label={strings.adaptWithAi} variant="secondary" onPress={() => router.push({ pathname: '/workout-adapt', params: { id: entry.id } })} />
              ) : null}
            </>
          )
        ) : null}

        {published ? (
          <GradientButton
            label={workout.isTemplate ? strings.removeFromTemplates : strings.saveAsTemplate}
            variant="secondary"
            onPress={() => {
              setTemplate(workout.id, !workout.isTemplate);
              setToast(workout.isTemplate ? strings.removedFromTemplates : strings.savedAsTemplate);
            }}
          />
        ) : null}
        <GradientButton
          label={strings.share}
          variant="secondary"
          onPress={() => {
            Share.share({ message: formatWorkoutShareText(content) }).catch(() => {});
          }}
        />

        {confirmingDelete ? (
          <Card style={styles.confirmCard}>
            <Text style={styles.confirmText}>{strings.confirmDelete}</Text>
            <View style={styles.confirmRow}>
              <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmingDelete(false)} />
              <GradientButton
                label={strings.deleteWorkout}
                colorsOverride={[colors.red, colors.red]}
                style={{ flex: 1 }}
                onPress={() => {
                  removeScheduled(entry.id);
                  router.back();
                }}
              />
            </View>
          </Card>
        ) : (
          <GradientButton label={strings.deleteWorkout} variant="tertiary" onPress={() => setConfirmingDelete(true)} />
        )}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.regular },
  draftNote: { color: colors.amber, fontSize: 13.5, fontFamily: fontFamily.semibold },
  resultsCard: { gap: spacing.sm },
  fuel: { gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  resultsTitle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  chip: { gap: 2 },
  chipLabel: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.medium },
  chipValue: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold },
  resultNotes: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  confirmCard: { gap: spacing.md },
  confirmText: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  confirmRow: { flexDirection: 'row', gap: spacing.md },
});
