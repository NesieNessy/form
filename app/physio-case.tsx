import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { NumberField } from '@/components/ui/NumberField';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { formatDateLabel } from '@/lib/date';
import { newUuid } from '@/lib/id';
import { addCaseNote, addRestriction, liftRestriction, listCases, publishRehabPlan, recordRtsDecision, type SharedCase } from '@/lib/rehab/api';
import { BODY_REGION_LABEL, EPISODE_STATUS_LABEL, RED_FLAGS, RTS_LABEL, RULE_LABEL, TAG_LABEL, TAG_ORDER, type ActivityTag, type RedFlag, type RestrictionRule, type RtsStage } from '@/lib/rehab/model';
import { resolveActivity } from '@/lib/workout/catalog';
import type { WorkoutContent } from '@/lib/workout/model';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

const RULES = (Object.keys(RULE_LABEL) as RestrictionRule[]).map((k) => ({ key: k, label: RULE_LABEL[k] }));
const STAGES = (Object.keys(RTS_LABEL) as RtsStage[]).map((k) => ({ key: k, label: RTS_LABEL[k] }));
const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Row = { key: string; name: string; sets?: number; reps?: number; hold?: number };

/**
 * The plan as Workout Core content: one sequence of exercises; any dose left
 * empty stays absent. Sets go into the step note, since a sequence has no
 * per-step sets.
 */
function planContent(title: string, rows: Row[]): WorkoutContent {
  return {
    title: title.trim(),
    sport: 'other',
    blocks: [
      {
        id: newUuid(),
        type: 'recovery',
        config: { format: 'sequence' },
        steps: rows
          .filter((r) => r.name.trim())
          .map((r) => ({
            kind: 'exercise' as const,
            id: newUuid(),
            name: r.name.trim(),
            activityId: resolveActivity(r.name)?.id ?? null,
            prescription: {
              ...(r.reps !== undefined ? { reps: r.reps } : {}),
              ...(r.hold !== undefined ? { durationSeconds: r.hold } : {}),
              ...(r.sets !== undefined ? { note: `${r.sets} sets` } : {}),
            },
          })),
      },
    ],
  };
}

export default function PhysioCaseScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const [c, setCase] = useState<SharedCase | null>(null);
  const [verified, setVerified] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tags, setTags] = useState<ActivityTag[]>([]);
  const [rule, setRule] = useState<RestrictionRule>('avoid');
  const [note, setNote] = useState('');
  const [ends, setEnds] = useState<Date | null>(null);
  const [pickingEnd, setPickingEnd] = useState(false);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<Row[]>([{ key: newUuid(), name: '' }]);
  const [sessions, setSessions] = useState<number | undefined>(undefined);
  const [planNotes, setPlanNotes] = useState('');
  const [caseNote, setCaseNote] = useState('');
  const [stage, setStage] = useState<RtsStage>('participation');
  const [criteria, setCriteria] = useState('');

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    const res = await listCases();
    if (!res.ok) return setToast(res.error);
    setVerified(res.data.verified);
    setCase(res.data.cases.find((x) => x.episode.id === episodeId) ?? null);
  }, [episodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = async (res: { ok: boolean; error?: string }, message: string = strings.saved) => {
    if (!res.ok) return setToast(res.error ?? '');
    setToast(message);
    await load();
  };

  if (!c) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.physioTitle} />
        <Text style={[styles.body, { padding: spacing.xl }]}>{strings.loading}</Text>
      </View>
    );
  }

  const plan = c.records.plans.filter((p) => p.status === 'published').sort((a, b) => b.version - a.version)[0];

  return (
    <View style={styles.screen}>
      <DetailHeader title={c.athlete.name ?? strings.someone} subtitle={`${BODY_REGION_LABEL[c.episode.bodyRegion]} · ${EPISODE_STATUS_LABEL[c.episode.status]}`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.body}>{`“${c.episode.reportedProblem}”`}</Text>
          {c.episode.affectedActivities.length ? <Text style={styles.meta}>{c.episode.affectedActivities.map((t) => TAG_LABEL[t]).join(', ')}</Text> : null}
          {c.symptoms.slice(0, 8).map((s, i) => (
            <View key={i} style={styles.line}>
              <Text style={styles.meta}>{day(s.loggedAt)}</Text>
              <Text style={[styles.lineValue, s.redFlags.length > 0 && styles.flagged]}>
                {[`${s.intensity}/10`, s.function !== undefined ? `function ${s.function}/10` : undefined, s.context, ...s.redFlags.map((f) => RED_FLAGS[f as RedFlag])].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>{strings.fromYourPhysio}</Text>
        {c.records.restrictions.map((r) => (
          <Card key={r.id} style={[styles.card, r.status === 'lifted' && styles.dim]}>
            <View style={styles.line}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{`${RULE_LABEL[r.rule]}: ${r.tags.map((t) => TAG_LABEL[t].toLowerCase()).join(', ')}`}</Text>
              {r.status === 'active' ? (
                <TouchableOpacity onPress={async () => done(await liftRestriction(r.id))} hitSlop={8}>
                  <Text style={styles.link}>{strings.lift}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.meta}>{strings.lifted}</Text>
              )}
            </View>
            {r.note ? <Text style={styles.body}>{r.note}</Text> : null}
            {r.expiresOn ? <Text style={styles.meta}>{strings.restrictionUntil(r.expiresOn)}</Text> : null}
          </Card>
        ))}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.addRestriction}</Text>
          <Text style={styles.label}>{strings.restrictionTags}</Text>
          <ChipSelect options={TAG_ORDER.map((t) => ({ key: t, label: TAG_LABEL[t] }))} selected={tags} onToggle={(t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))} />
          <Text style={styles.label}>{strings.restrictionRule}</Text>
          <SegmentedTabs options={RULES} value={rule} onChange={(k) => setRule(k as RestrictionRule)} size="sm" />
          <FieldCard label={strings.restrictionNote} value={note} onChangeText={setNote} placeholder={strings.restrictionNotePlaceholder} maxLength={500} cardStyle={styles.inset} />
          <TouchableOpacity style={styles.line} onPress={() => setPickingEnd(true)}>
            <Text style={styles.label}>{strings.restrictionEnds}</Text>
            <Text style={styles.lineValue}>{ends ? formatDateLabel(ends) : strings.restrictionNoEnd}</Text>
          </TouchableOpacity>
          <DatePickerModal visible={pickingEnd} date={ends ?? new Date()} onClose={() => setPickingEnd(false)} onSelect={(d) => (setEnds(d), setPickingEnd(false))} />
          <GradientButton
            label={strings.addRestriction}
            variant="secondary"
            onPress={async () => {
              if (!tags.length) return setToast(strings.restrictionTags);
              await done(await addRestriction(c.episode.id, tags, rule, note, ends ? iso(ends) : null));
              setTags([]);
              setNote('');
              setEnds(null);
            }}
          />
        </Card>

        {plan ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{`${strings.rehabPlan} · v${plan.version}`}</Text>
            <WorkoutSummaryView content={plan.content} dateTimeMs={plan.createdAt} />
          </Card>
        ) : null}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.buildPlan}</Text>
          <Text style={styles.hint}>{strings.planHint}</Text>
          <FieldCard label={strings.planTitle} value={title} onChangeText={setTitle} cardStyle={styles.inset} />
          {rows.map((r, i) => (
            <View key={r.key} style={styles.planRow}>
              <FieldCard label={`${strings.planExercise} ${i + 1}`} value={r.name} onChangeText={(name) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, name } : x)))} cardStyle={styles.inset} />
              <View style={styles.row}>
                <NumberField label={strings.planSets} value={r.sets} onChange={(sets) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, sets } : x)))} />
                <NumberField label={strings.planReps} value={r.reps} onChange={(reps) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, reps } : x)))} />
                <NumberField label={strings.planHold} value={r.hold} onChange={(hold) => setRows((cur) => cur.map((x) => (x.key === r.key ? { ...x, hold } : x)))} />
              </View>
            </View>
          ))}
          <GradientButton label={strings.addExerciseRow} variant="tertiary" onPress={() => setRows((cur) => [...cur, { key: newUuid(), name: '' }])} />
          <NumberField label={strings.planSessions} value={sessions} onChange={setSessions} />
          <FieldCard label={strings.planNotes} value={planNotes} onChangeText={setPlanNotes} maxLength={2000} multiline cardStyle={styles.inset} />
          <GradientButton
            label={strings.publishPlan}
            onPress={async () => {
              const res = await publishRehabPlan(c.episode.id, planContent(title, rows), sessions ?? null, planNotes);
              await done(res, strings.planPublished);
              if (res.ok) {
                setTitle('');
                setRows([{ key: newUuid(), name: '' }]);
                setPlanNotes('');
              }
            }}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.reviewNotes}</Text>
          {c.records.notes.map((n) => (
            <Text key={n.id} style={styles.body}>{`${day(n.createdAt)}: ${n.body}`}</Text>
          ))}
          <FieldCard label={strings.addNote} value={caseNote} onChangeText={setCaseNote} placeholder={strings.notePlaceholderClinical} maxLength={4000} multiline cardStyle={styles.inset} />
          <GradientButton label={strings.addNote} variant="secondary" onPress={async () => (await done(await addCaseNote(c.episode.id, caseNote)), setCaseNote(''))} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.rtsTitle}</Text>
          {c.records.decisions.map((d) => (
            <Text key={d.id} style={styles.body}>{`${RTS_LABEL[d.stage]} · ${day(d.decidedAt)} · ${d.criteria}`}</Text>
          ))}
          {verified ? (
            <>
              <SegmentedTabs options={STAGES} value={stage} onChange={(k) => setStage(k as RtsStage)} scrollable size="sm" />
              <FieldCard label={strings.decisionCriteria} value={criteria} onChangeText={setCriteria} placeholder={strings.decisionCriteriaPlaceholder} maxLength={2000} multiline cardStyle={styles.inset} />
              <GradientButton label={strings.recordDecision} variant="secondary" onPress={async () => (await done(await recordRtsDecision(c.episode.id, stage, criteria)), setCriteria(''))} />
            </>
          ) : (
            <Text style={styles.hint}>{strings.unverifiedBanner}</Text>
          )}
        </Card>
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.sm },
  dim: { opacity: 0.6 },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  lineValue: { flexShrink: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  flagged: { color: colors.red },
  link: { color: colors.teal, fontSize: 13, fontFamily: fontFamily.semibold },
  planRow: { gap: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.sm },
});
