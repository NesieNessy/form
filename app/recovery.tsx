import { Sensitive } from '@/components/ui/Sensitive';
import { SourceTag } from '@/components/ui/SourceTag';
import { signalSource } from '@/lib/provenance';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { diffWorkouts } from '@/lib/ai/diff';
import { newUuid } from '@/lib/id';
import { optionsFor } from '@/lib/recovery/adjust';
import type { CheckIn, OptionKind, RecoveryStatus } from '@/lib/recovery/model';
import { insightFor, localDateOf, previewOption } from '@/lib/recovery/state';
import { strings } from '@/lib/strings';
import { getWorkoutData, useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

const SCALE = Array.from({ length: 11 }, (_, i) => ({ key: String(i), label: String(i) }));
const QUESTIONS: { key: 'fatigue' | 'soreness' | 'stress' | 'energy'; label: string }[] = [
  { key: 'fatigue', label: strings.checkInFatigue },
  { key: 'soreness', label: strings.checkInSoreness },
  { key: 'stress', label: strings.checkInStress },
  { key: 'energy', label: strings.checkInEnergy },
];
const STATUS_TEXT: Record<RecoveryStatus, string> = {
  steady: strings.statusSteady,
  attention: strings.statusAttention,
  conflicting: strings.statusConflicting,
  limited_data: strings.statusLimited,
  unwell: strings.statusUnwell,
};
const OPTION_LABEL: Record<OptionKind, string> = {
  keep: strings.optionKeep,
  shorten: strings.optionShorten,
  lighter: strings.optionLighter,
  reschedule: strings.optionReschedule,
  rest: strings.optionRest,
};

export default function RecoveryScreen() {
  const observations = useWorkoutsStore((s) => s.observations);
  const scheduled = useWorkoutsStore((s) => s.scheduled);
  const versions = useWorkoutsStore((s) => s.versions);
  const sessions = useWorkoutsStore((s) => s.sessions);
  const recovery = useWorkoutsStore((s) => s.recovery);
  const saveCheckIn = useWorkoutsStore((s) => s.saveCheckIn);
  const recordRecoveryDay = useWorkoutsStore((s) => s.recordRecoveryDay);
  const chooseRecoveryOption = useWorkoutsStore((s) => s.chooseRecoveryOption);
  const [answers, setAnswers] = useState<CheckIn>({});
  const [editing, setEditing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const today = localDateOf(Date.now());
  // Recomputed whenever the underlying data changes; the rules live in lib/recovery.
  const insight = useMemo(() => insightFor(getWorkoutData(), Date.now()), [observations, scheduled, versions, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const day = Object.values(recovery).find((d) => d.localDate === today && !d.deletedAt);
  const checkedIn = Object.values(observations).some((o) => !o.deletedAt && o.localDate === today && o.metric === 'unwell');

  useEffect(() => setEditing(!checkedIn), [checkedIn]);

  // Keep today's shareable summary in step with what the screen shows.
  useFocusEffect(
    useCallback(() => {
      const summary = (s: { status: string; signals: { key: string; direction: string }[] }) => JSON.stringify([s.status, s.signals.map((x) => [x.key, x.direction])]);
      if (insight.status !== 'limited_data' && (!day || summary(day) !== summary(insight))) recordRecoveryDay(insight);
    }, [insight, day, recordRecoveryDay])
  );

  const entry = insight.scheduledId ? scheduled[insight.scheduledId] : undefined;
  const content = entry ? versions[entry.versionId]?.content : undefined;
  const options = optionsFor(insight.options, content, newUuid);
  const chosen = day?.decision;

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.recoveryTitle} subtitle={strings.recoverySubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.checkInTitle}</Text>
          {editing ? (
            <>
              <Text style={styles.hint}>{strings.checkInHint}</Text>
              {QUESTIONS.map((q) => (
                <View key={q.key} style={styles.question}>
                  <Text style={styles.label}>{q.label}</Text>
                  <SegmentedTabs options={SCALE} value={answers[q.key] !== undefined ? String(answers[q.key]) : ''} onChange={(k) => setAnswers((a) => ({ ...a, [q.key]: Number(k) }))} scrollable size="sm" />
                </View>
              ))}
              <TouchableOpacity style={styles.toggle} onPress={() => setAnswers((a) => ({ ...a, unwell: !a.unwell }))} accessibilityRole="checkbox" accessibilityState={{ checked: !!answers.unwell }} aria-checked={!!answers.unwell}>
                <View style={[styles.box, answers.unwell && styles.boxOn]} />
                <Text style={styles.toggleText}>{strings.checkInUnwell}</Text>
              </TouchableOpacity>
              <GradientButton
                label={strings.saveCheckIn}
                onPress={() => {
                  saveCheckIn(answers);
                  setMessage(strings.checkInSaved);
                  setEditing(false);
                }}
              />
            </>
          ) : (
            <GradientButton label={strings.updateCheckIn} variant="secondary" onPress={() => setEditing(true)} />
          )}
          {message ? <Text style={styles.hint}>{message}</Text> : null}
        </Card>

        <Text style={styles.sectionTitle}>{strings.todayTitle}</Text>
        <Card style={[styles.card, insight.status === 'attention' && styles.attention, insight.status === 'unwell' && styles.unwell]}>
          <Text style={styles.status}>{STATUS_TEXT[insight.status]}</Text>
          {insight.signals.map((s) => (
            <View key={s.key} style={styles.signal}>
              <View style={{ gap: 2 }}>
                <Text style={styles.signalLabel}>{strings.signalLabels[s.key]}</Text>
                <SourceTag source={signalSource(s.source)} />
              </View>
              <Sensitive style={[styles.signalValue, s.direction === 'worse' && styles.worse]}>
                {`${s.direction === 'worse' ? strings.directionWorse : s.direction === 'better' ? strings.directionBetter : strings.directionUsual} · ${s.detail}`}
              </Sensitive>
            </View>
          ))}
          {insight.missing.length ? <Text style={styles.hint}>{`${strings.missingTitle}: ${insight.missing.join(', ')}.`}</Text> : null}
          <Text style={styles.hint}>{strings.recoveryNotDiagnosis}</Text>
        </Card>

        {chosen ? (
          // Once chosen, the choice is shown whatever it was, even when the workout is no longer planned for today.
          <Card style={styles.card}>
            <Text style={styles.body}>{strings.youChose(OPTION_LABEL[chosen.option])}</Text>
            {chosen.scheduledId && scheduled[chosen.scheduledId] && !scheduled[chosen.scheduledId].deletedAt ? (
              <GradientButton label={strings.openWorkout} variant="secondary" onPress={() => router.push({ pathname: '/workout-detail', params: { id: chosen.scheduledId as string } })} />
            ) : null}
          </Card>
        ) : content && entry && options.length ? (
          <>
            <Text style={styles.sectionTitle}>{strings.optionsFor(content.title)}</Text>
            <Text style={styles.hint}>{strings.optionsHint}</Text>
            {options.map((o) => {
              const preview = o === 'shorten' || o === 'lighter' ? previewOption(getWorkoutData(), entry.id, o) : undefined;
              const changes = preview ? diffWorkouts(preview.before, preview.after) : [];
              return (
                <Card key={o} style={styles.card}>
                  <Text style={styles.cardTitle}>{OPTION_LABEL[o]}</Text>
                  {o === 'lighter' ? <Text style={styles.hint}>{strings.optionLighterBody}</Text> : null}
                  {o === 'shorten' ? <Text style={styles.hint}>{strings.optionShortenBody}</Text> : null}
                  {changes.map((c, i) => (
                    <View key={i} style={styles.change}>
                      <Text style={styles.changeWhere}>{c.where}</Text>
                      {c.before ? <Text style={styles.before}>{c.before}</Text> : null}
                      {c.after ? <Text style={styles.after}>{c.after}</Text> : null}
                    </View>
                  ))}
                  <GradientButton
                    label={strings.choose}
                    variant={o === options[0] ? 'primary' : 'secondary'}
                    onPress={() => chooseRecoveryOption(insight, o)}
                    accessibilityLabel={`${strings.choose}: ${OPTION_LABEL[o]}`}
                  />
                </Card>
              );
            })}
          </>
        ) : !entry ? (
          <Text style={styles.hint}>{strings.noPlannedToday}</Text>
        ) : null}      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  card: { gap: spacing.sm },
  attention: { borderColor: `${colors.amber}88` },
  unwell: { borderColor: `${colors.red}88` },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  status: { color: colors.text, fontSize: 15, lineHeight: 21, fontFamily: fontFamily.semibold },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  question: { gap: 4 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textTertiary },
  boxOn: { backgroundColor: colors.red, borderColor: colors.red },
  toggleText: { color: colors.text, fontSize: 14, flex: 1, fontFamily: fontFamily.regular },
  signal: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  signalLabel: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.medium },
  signalValue: { flexShrink: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontFamily: fontFamily.regular },
  worse: { color: colors.amber },
  change: { gap: 2, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  changeWhere: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.medium },
  before: { color: colors.textTertiary, fontSize: 13, textDecorationLine: 'line-through', fontFamily: fontFamily.regular },
  after: { color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
});
