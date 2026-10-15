import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NumberField } from '@/components/ui/NumberField';
import { strings } from '@/lib/strings';
import { formatPrescription } from '@/lib/workout/format';
import { exerciseSteps, type Block, type BlockResult, type Score, type StepResult } from '@/lib/workout/model';
import { bestLoadKg, scoreKindFor } from '@/lib/workout/scoring';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  block: Block;
  result: BlockResult;
  onChange: (result: BlockResult) => void;
};

/**
 * Entry of what actually happened in one block. Which fields appear follows
 * from the block's format. Used both after a timed block in the player and
 * for logging a workout after the fact.
 */
export function BlockResultEditor({ block, result, onChange }: Props) {
  const kind = scoreKindFor(block);
  const skipped = result.status === 'skipped';

  const setScore = (score: Score | undefined, extra: Partial<BlockResult> = {}) => onChange({ ...result, ...extra, score });

  const setSteps = (stepResults: StepResult[]) => {
    const kg = bestLoadKg(stepResults);
    onChange({ ...result, stepResults, score: kg !== undefined ? { type: 'load', kg } : { type: 'completed' } });
  };
  const patchStep = (index: number, patch: Partial<StepResult>) =>
    setSteps(result.stepResults.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const elapsed = result.elapsedSeconds;
  const elapsedMin = elapsed === undefined ? undefined : Math.floor(elapsed / 60);
  const elapsedSec = elapsed === undefined ? undefined : Math.round(elapsed % 60);
  const combine = (min: number | undefined, sec: number | undefined) =>
    min === undefined && sec === undefined ? undefined : (min ?? 0) * 60 + Math.min(59, sec ?? 0);

  const timeFields = (onTime: (seconds: number | undefined) => void) => (
    <View style={styles.row}>
      <NumberField label={strings.timeLabel} suffix={strings.minutesShort} value={elapsedMin} onChange={(m) => onTime(combine(m, elapsedSec))} />
      <NumberField label=" " suffix={strings.secondsShort} value={elapsedSec} onChange={(s) => onTime(combine(elapsedMin, s))} />
    </View>
  );

  return (
    <View style={styles.wrap}>
      {skipped ? null : (
        <>
          {kind === 'time'
            ? timeFields((seconds) => setScore(seconds === undefined ? undefined : { type: 'time', seconds }, { elapsedSeconds: seconds }))
            : null}

          {kind === 'rounds_reps' ? (
            <View style={styles.row}>
              <NumberField
                label={strings.roundsDone}
                value={result.score?.type === 'rounds_reps' ? result.score.rounds : undefined}
                onChange={(rounds) =>
                  setScore({ type: 'rounds_reps', rounds: rounds ?? 0, reps: result.score?.type === 'rounds_reps' ? result.score.reps : 0 })
                }
              />
              <NumberField
                label={strings.extraReps}
                value={result.score?.type === 'rounds_reps' ? result.score.reps : undefined}
                onChange={(reps) =>
                  setScore({ type: 'rounds_reps', rounds: result.score?.type === 'rounds_reps' ? result.score.rounds : 0, reps: reps ?? 0 })
                }
              />
            </View>
          ) : null}

          {kind === 'distance' ? (
            <>
              <NumberField
                label={strings.distanceMeters}
                suffix="m"
                value={result.score?.type === 'distance' ? result.score.meters : undefined}
                onChange={(meters) => setScore(meters ? { type: 'distance', meters } : { type: 'completed' })}
                style={styles.single}
              />
              {timeFields((seconds) => onChange({ ...result, elapsedSeconds: seconds }))}
            </>
          ) : null}

          {kind === 'load'
            ? exerciseSteps(block.steps).map((step) => {
                const rows = result.stepResults.map((r, index) => ({ r, index })).filter(({ r }) => r.stepId === step.id);
                if (rows.length === 0) return null;
                const target = formatPrescription(step.prescription);
                return (
                  <View key={step.id} style={styles.exercise}>
                    <Text style={styles.exerciseName}>{step.name}</Text>
                    {target ? <Text style={styles.exerciseTarget}>{target}</Text> : null}
                    {rows.map(({ r, index }) => (
                      <View key={index} style={styles.setRow}>
                        <Text style={styles.setLabel}>{strings.setNumber((r.setIndex ?? 0) + 1)}</Text>
                        <NumberField value={r.reps} suffix={strings.reps.toLowerCase()} onChange={(reps) => patchStep(index, { reps })} />
                        <NumberField value={r.loadKg} suffix={strings.kg} decimals onChange={(loadKg) => patchStep(index, { loadKg })} />
                        <TouchableOpacity
                          hitSlop={8}
                          onPress={() => patchStep(index, { completed: !r.completed })}
                          style={[styles.check, r.completed && styles.checkOn]}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: r.completed }}
                          accessibilityLabel={strings.setNumber((r.setIndex ?? 0) + 1)}
                        >
                          {r.completed ? <Icons.checkCircle size={18} color={colors.onAction} strokeWidth={iconStrokeWidth} /> : null}
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })
            : null}
        </>
      )}

      <TouchableOpacity
        onPress={() => onChange({ ...result, status: skipped ? 'completed' : 'skipped' })}
        hitSlop={8}
        style={styles.skipBtn}
      >
        <Text style={styles.skipLabel}>{skipped ? strings.markDone : strings.markSkipped}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  single: { flex: 0 },
  exercise: { gap: spacing.sm },
  exerciseName: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  exerciseTarget: { color: colors.textTertiary, fontSize: 12, marginTop: -4, fontFamily: fontFamily.regular },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setLabel: { width: 44, color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  check: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  skipBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  skipLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold },
});
