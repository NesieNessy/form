import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockResultEditor } from '@/components/player/BlockResultEditor';
import { SessionWrapUp } from '@/components/player/SessionWrapUp';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { Stepper } from '@/components/ui/Stepper';
import { oneRepMaxByActivity } from '@/lib/athlete/model';
import { strings } from '@/lib/strings';
import { blockLabel, formatBlockHeadline, formatClock, formatStep } from '@/lib/workout/format';
import { exerciseSteps, type Block, type SessionProgress, type Step } from '@/lib/workout/model';
import { deriveScore, emptyBlockResult } from '@/lib/workout/scoring';
import { IDLE_TIMER, describeClock, elapsedMs, isRunning, pauseTimer, startTimer } from '@/lib/workout/timer';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

function buzz(kind: 'tick' | 'done') {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'done'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  run.catch(() => {});
}

/** Rounds are counted by hand for formats where the athlete, not the clock, advances them. */
function countsRounds(block: Block): boolean {
  const c = block.config;
  return c.format === 'amrap' || ((c.format === 'for_time' || c.format === 'sequence') && (c.rounds ?? 1) > 1);
}

export default function WorkoutPlayerScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>();
  const session = useWorkoutsStore((s) => (sessionId ? s.sessions[sessionId] : undefined));
  const patchSession = useWorkoutsStore((s) => s.patchSession);
  const putBlockResult = useWorkoutsStore((s) => s.putBlockResult);
  const completeSession = useWorkoutsStore((s) => s.completeSession);
  const discardSession = useWorkoutsStore((s) => s.discardSession);
  const benchmarks = useWorkoutsStore((s) => s.benchmarks);
  const oneRepMax = useMemo(() => oneRepMaxByActivity(Object.values(benchmarks)), [benchmarks]);

  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const progress = session?.progress;
  const blocks = session?.prescribed.blocks ?? [];
  const block = progress ? blocks[progress.blockIndex] : undefined;
  const timer = progress?.timer ?? IDLE_TIMER;
  const running = isRunning(timer);

  // The display re-reads the device clock; elapsed time itself never depends on these ticks.
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  const elapsedSeconds = elapsedMs(timer, running ? now : Date.now()) / 1000;
  const clock = block ? describeClock(block.config, elapsedSeconds, block.steps.length) : undefined;
  const result = block ? session?.blockResults.find((r) => r.blockId === block.id) : undefined;

  const setProgress = useCallback(
    (patch: Partial<SessionProgress>) => {
      if (!sessionId || !progress) return;
      patchSession(sessionId, { progress: { ...progress, ...patch } });
    },
    [sessionId, progress, patchSession]
  );

  // Each block gets a result row as soon as it is on screen, so sets logged mid-block survive a reload.
  useEffect(() => {
    if (sessionId && block && !result) putBlockResult(sessionId, { ...emptyBlockResult(block, oneRepMax), status: 'partial' });
  }, [sessionId, block, result, putBlockResult, oneRepMax]);

  const stopBlock = useCallback(() => {
    if (!sessionId || !block || !progress || !clock) return;
    const stoppedAt = Date.now();
    const counted = describeClock(block.config, elapsedMs(progress.timer, stoppedAt) / 1000, block.steps.length).countedSeconds;
    const current = result ?? { ...emptyBlockResult(block, oneRepMax), status: 'partial' as const };
    putBlockResult(sessionId, {
      ...current,
      status: 'completed',
      elapsedSeconds: counted >= 1 ? Math.floor(counted) : undefined,
      score: deriveScore(block, { elapsedSeconds: counted, roundsCompleted: progress.roundsCompleted, stepResults: current.stepResults }),
    });
    if (exerciseSteps(block.steps).length === 0) {
      // A timed pause has no result to confirm, so move straight on.
      setProgress({ blockIndex: progress.blockIndex + 1, timer: IDLE_TIMER, roundsCompleted: 0, awaitingResult: false });
      return;
    }
    setProgress({ timer: pauseTimer(progress.timer, stoppedAt), awaitingResult: true });
  }, [sessionId, block, progress, clock, result, putBlockResult, setProgress, oneRepMax]);

  // The format's own end (countdown at zero, last interval over, cap hit) stops the block.
  const finished = clock?.finished ?? false;
  useEffect(() => {
    if (finished && running && progress && !progress.awaitingResult) {
      buzz('done');
      stopBlock();
    }
  }, [finished, running, progress, stopBlock]);

  const cue = `${clock?.round ?? 0}-${clock?.phase ?? ''}`;
  const lastCue = useRef(cue);
  useEffect(() => {
    if (running && cue !== lastCue.current) buzz('tick');
    lastCue.current = cue;
  }, [cue, running]);

  if (!session || !sessionId || session.status !== 'in_progress' || !progress) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missing}>{strings.sessionMissing}</Text>
        <GradientButton label={strings.back} variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
      </View>
    );
  }

  const isWrapUp = progress.blockIndex >= blocks.length;
  const isLastBlock = progress.blockIndex === blocks.length - 1;

  const goNext = () => {
    patchSession(sessionId, {
      progress: { blockIndex: progress.blockIndex + 1, timer: IDLE_TIMER, roundsCompleted: 0, awaitingResult: false },
    });
  };

  const skipBlock = () => {
    if (!block) return;
    putBlockResult(sessionId, { blockId: block.id, status: 'skipped', stepResults: [] });
    goNext();
  };

  const finishWorkout = () => {
    const scheduledId = session.scheduledWorkoutId;
    completeSession(sessionId, { rpe, notes });
    // Opened from the detail screen: go back to it, now showing the results, instead of stacking a second copy.
    if (from === 'detail') router.back();
    else if (scheduledId) router.replace(`/workout-detail?id=${scheduledId}`);
    else router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => setLeaving(true)} hitSlop={12} style={styles.closeBtn} accessibilityLabel={strings.leaveWorkout}>
          <Icons.chevronLeft size={22} strokeWidth={iconStrokeWidth} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.workoutTitle} numberOfLines={1}>
            {session.prescribed.title}
          </Text>
          <Text style={styles.blockCount}>
            {isWrapUp ? strings.results : strings.blockOf(progress.blockIndex + 1, blocks.length)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {isWrapUp || !block || !clock ? (
          <SessionWrapUp rpe={rpe} onRpeChange={setRpe} notes={notes} onNotesChange={setNotes} />
        ) : (
          <>
            <View>
              <Text style={styles.blockLabel}>{blockLabel(block)}</Text>
              <Text style={styles.blockHeadline}>{formatBlockHeadline(block)}</Text>
              {block.notes ? <Text style={styles.blockNotes}>{block.notes}</Text> : null}
            </View>

            <Card style={styles.clockCard}>
              {clock.round !== undefined && clock.totalRounds !== undefined ? (
                <Text style={styles.clockMeta}>{strings.roundOf(clock.round, clock.totalRounds)}</Text>
              ) : null}
              <Text style={[styles.clock, clock.phase === 'rest' && !clock.finished && styles.clockRest]} accessibilityRole="timer">
                {formatClock(clock.mode === 'up' ? Math.floor(clock.displaySeconds) : Math.ceil(clock.displaySeconds))}
              </Text>
              <Text style={styles.clockMeta}>
                {clock.finished
                  ? strings.timeUp
                  : clock.mode === 'interval' && block.config.format === 'repeating_interval' && block.config.workSeconds !== undefined
                    ? clock.phase === 'rest'
                      ? strings.rest
                      : strings.work
                    : clock.totalSeconds !== undefined && clock.mode === 'up'
                      ? `${strings.cap} ${formatClock(clock.totalSeconds)}`
                      : ' '}
              </Text>
            </Card>

            {countsRounds(block) && !progress.awaitingResult ? (
              <Card style={styles.roundsCard}>
                <Text style={styles.roundsLabel}>{strings.roundsDone}</Text>
                <View style={{ width: 150 }}>
                  <Stepper value={progress.roundsCompleted} onChange={(roundsCompleted) => setProgress({ roundsCompleted })} min={0} />
                </View>
              </Card>
            ) : null}

            {progress.awaitingResult && result ? (
              <Card style={styles.resultCard}>
                <Text style={styles.resultTitle}>{strings.yourResult}</Text>
                <BlockResultEditor block={block} result={result} onChange={(next) => putBlockResult(sessionId, next)} />
              </Card>
            ) : block.config.format === 'sets_reps' && result ? (
              <Card style={styles.resultCard}>
                <BlockResultEditor block={block} result={result} onChange={(next) => putBlockResult(sessionId, next)} />
              </Card>
            ) : (
              <Card style={styles.stepsCard}>
                {block.steps.map((step, index) => (
                  <PlayerStep key={step.id} step={step} depth={0} active={clock.activeStepIndex === index && running} />
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        {isWrapUp || !block ? (
          <GradientButton label={strings.saveResults} onPress={finishWorkout} />
        ) : progress.awaitingResult ? (
          <GradientButton label={isLastBlock ? strings.finishWorkout : strings.nextBlock} onPress={goNext} />
        ) : (
          <>
            <GradientButton
              label={running ? strings.pause : elapsedSeconds > 0 ? strings.resume : strings.startTimer}
              onPress={() => {
                const at = Date.now();
                setNow(at);
                setProgress({ timer: running ? pauseTimer(timer, at) : startTimer(timer, at) });
              }}
            />
            <View style={styles.footerRow}>
              <GradientButton label={strings.skipBlock} variant="tertiary" onPress={skipBlock} style={styles.footerSide} />
              <GradientButton label={strings.finishBlock} variant="secondary" onPress={stopBlock} style={styles.footerMain} />
            </View>
          </>
        )}
      </View>

      <Modal visible={leaving} transparent animationType="fade" onRequestClose={() => setLeaving(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLeaving(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{strings.leaveWorkout}</Text>
            <Text style={styles.sheetBody}>{strings.leaveWorkoutBody}</Text>
            <GradientButton
              label={strings.keepForLater}
              onPress={() => {
                // Park the clock so time away is not counted against the workout.
                if (running) setProgress({ timer: pauseTimer(timer, Date.now()) });
                setLeaving(false);
                router.back();
              }}
            />
            <GradientButton
              label={strings.discardSession}
              variant="secondary"
              onPress={() => {
                setLeaving(false);
                discardSession(sessionId);
                router.back();
              }}
            />
            <GradientButton label={strings.cancel} variant="tertiary" onPress={() => setLeaving(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PlayerStep({ step, depth, active }: { step: Step; depth: number; active: boolean }) {
  const { title, detail } = formatStep(step);
  return (
    <>
      <View style={[styles.stepRow, { marginLeft: depth * spacing.lg }, active && styles.stepRowActive]}>
        <Text style={[styles.stepTitle, active && styles.stepTitleActive]}>{title}</Text>
        {detail ? <Text style={styles.stepDetail}>{detail}</Text> : null}
      </View>
      {step.kind === 'group' ? step.steps.map((child) => <PlayerStep key={child.id} step={child} depth={depth + 1} active={false} />) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  missing: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.regular },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.screenX, paddingBottom: spacing.md },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  workoutTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold },
  blockCount: { color: colors.textSecondary, fontSize: 12.5, marginTop: 1, fontFamily: fontFamily.regular },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  blockLabel: { color: colors.text, fontSize: 22, fontFamily: fontFamily.semibold },
  blockHeadline: { color: colors.textSecondary, fontSize: 14, marginTop: 2, fontFamily: fontFamily.medium },
  blockNotes: { color: colors.textTertiary, fontSize: 13, marginTop: 4, fontFamily: fontFamily.regular },
  clockCard: { alignItems: 'center', paddingVertical: spacing.xl },
  clock: { color: colors.text, fontSize: 68, fontFamily: fontFamily.semibold, fontVariant: ['tabular-nums'], letterSpacing: -1 },
  clockRest: { color: colors.teal },
  clockMeta: { color: colors.textSecondary, fontSize: 13.5, fontFamily: fontFamily.semibold },
  roundsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundsLabel: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  resultCard: { gap: spacing.md },
  resultTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  stepsCard: { gap: 2 },
  stepRow: { paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  stepRowActive: { backgroundColor: colors.cardAlt },
  stepTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.semibold },
  stepTitleActive: { color: colors.blue },
  stepDetail: { color: colors.textSecondary, fontSize: 13, marginTop: 1, fontFamily: fontFamily.regular },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, gap: spacing.sm },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footerSide: { paddingHorizontal: spacing.lg },
  footerMain: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontFamily: fontFamily.bold },
  sheetBody: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, marginBottom: spacing.sm, fontFamily: fontFamily.regular },
});
