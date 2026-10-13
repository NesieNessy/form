import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { formatDateLabel, formatTimeLabel } from '@/lib/date';
import { strings } from '@/lib/strings';
import { blockLabel, formatBlockHeadline, formatScore, formatStep } from '@/lib/workout/format';
import type { Block, BlockResult, BlockType, Step, WorkoutContent } from '@/lib/workout/model';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';
import { Icons, type LucideIcon } from '@/theme/icons';

type Props = {
  content: WorkoutContent;
  dateTimeMs?: number;
  /** When given, each section shows what was actually achieved next to what was prescribed. */
  blockResults?: BlockResult[];
};

const BLOCK_ICON: Record<BlockType, LucideIcon> = {
  warmup: Icons.flame,
  strength: Icons.dumbbell,
  skill: Icons.target,
  accessory: Icons.layoutGrid,
  conditioning: Icons.star,
  endurance: Icons.heartPulse,
  interval: Icons.timer,
  mobility: Icons.personStanding,
  recovery: Icons.heart,
  transition: Icons.arrowRight,
  cooldown: Icons.wind,
};

function StepLine({ step, depth }: { step: Step; depth: number }) {
  const { title, detail } = formatStep(step);
  const isGroup = step.kind === 'group';
  const Icon = step.kind === 'exercise' ? Icons.dumbbell : isGroup ? Icons.repeat : Icons.clock;
  return (
    <>
      <View style={[styles.stepRow, { marginLeft: depth * spacing.lg }]}>
        <View style={styles.stepBullet}>
          <Icon size={13} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stepName}>{title}</Text>
          {detail ? <Text style={styles.stepDetail}>{detail}</Text> : null}
          {step.kind === 'exercise' && step.notes ? <Text style={styles.stepDetail}>{step.notes}</Text> : null}
        </View>
      </View>
      {isGroup ? step.steps.map((child) => <StepLine key={child.id} step={child} depth={depth + 1} />) : null}
    </>
  );
}

function BlockCard({ block, result }: { block: Block; result?: BlockResult }) {
  const Icon = BLOCK_ICON[block.type] ?? Icons.dumbbell;
  const highlight = block.type === 'conditioning';

  const body = (
    <Card style={[styles.blockCard, highlight && styles.blockCardHighlight]}>
      <View style={styles.blockHeader}>
        <Icon size={15} color={highlight ? colors.text : colors.textSecondary} />
        <Text style={styles.blockTitle}>{blockLabel(block)}</Text>
        {result ? (
          <Text style={[styles.blockScore, result.status === 'skipped' && styles.blockScoreMuted]}>
            {result.status === 'skipped' ? strings.didNotDo : formatScore(result.score)}
          </Text>
        ) : null}
      </View>
      <Text style={styles.blockHeadline}>{formatBlockHeadline(block)}</Text>
      {block.notes ? <Text style={styles.blockNotes}>{block.notes}</Text> : null}
      <View style={styles.steps}>
        {block.steps.map((step) => (
          <StepLine key={step.id} step={step} depth={0} />
        ))}
      </View>
    </Card>
  );

  if (highlight) {
    return (
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.highlightBorder}>
        {body}
      </LinearGradient>
    );
  }
  return body;
}

export function WorkoutSummaryView({ content, dateTimeMs, blockResults }: Props) {
  const date = dateTimeMs !== undefined ? new Date(dateTimeMs) : undefined;
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <Text style={styles.title}>{content.title || strings.untitledWorkout}</Text>
        {date ? (
          <Text style={styles.date}>
            {formatDateLabel(date)} · {formatTimeLabel(date)}
          </Text>
        ) : null}
      </Card>

      {content.blocks.map((block) => (
        <BlockCard key={block.id} block={block} result={blockResults?.find((r) => r.blockId === block.id)} />
      ))}

      {content.description ? (
        <Card>
          <Text style={styles.blockTitle}>{strings.notes}</Text>
          <Text style={styles.notes}>{content.description}</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontFamily: fontFamily.bold },
  date: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
  highlightBorder: { borderRadius: radius.card + 1.5, padding: 1.5 },
  blockCard: { gap: 0 },
  blockCardHighlight: { borderWidth: 0 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  blockTitle: { flex: 1, color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  blockScore: { color: colors.teal, fontSize: 13.5, fontFamily: fontFamily.bold },
  blockScoreMuted: { color: colors.textTertiary },
  blockHeadline: { color: colors.textTertiary, fontSize: 12.5, marginTop: 4, fontFamily: fontFamily.medium },
  blockNotes: { color: colors.textSecondary, fontSize: 12.5, marginTop: 4, fontFamily: fontFamily.regular },
  steps: { gap: spacing.sm, marginTop: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepName: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
  stepDetail: { color: colors.textTertiary, fontSize: 12, marginTop: 1, fontFamily: fontFamily.regular },
  notes: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, fontFamily: fontFamily.regular },
});
