import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { ValidationIssues } from '@/components/workout/ValidationIssues';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { decideProposal, getProposal, reviseProposal, type Proposal } from '@/lib/ai/client';
import { LIMITS } from '@/lib/ai/pipeline';
import { combineDateAndTime, formatDateLabel } from '@/lib/date';
import { newUuid } from '@/lib/id';
import { strings } from '@/lib/strings';
import { validateWorkout } from '@/lib/workout/validate';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/**
 * Review of one assistant proposal. Nothing the assistant produced is saved
 * until the athlete approves it here, and what gets saved is re-validated
 * on this device and again by the server.
 */
export default function ProposalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const createWorkout = useWorkoutsStore((s) => s.createWorkout);
  const applyAdaptation = useWorkoutsStore((s) => s.applyAdaptation);
  const scheduled = useWorkoutsStore((s) => s.scheduled);

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'revise' | 'discard'>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [note, setNote] = useState('');
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoaded(false);
    getProposal(id).then((p) => {
      if (cancelled) return;
      setProposal(p);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!proposal) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.proposalTitle} />
        <View style={styles.centered}>{loaded ? <Text style={styles.body}>{strings.proposalMissing}</Text> : <ActivityIndicator color={colors.blue} />}</View>
      </View>
    );
  }

  const isAdaptation = proposal.type === 'workout_adaptation';
  const pending = proposal.status === 'pending_approval' && new Date(proposal.expires_at).getTime() > Date.now();
  // Checked again here rather than trusting the stored verdict.
  const validation = validateWorkout(proposal.content);
  const entry = proposal.source.kind === 'workout' ? scheduled[proposal.source.scheduled_id] : undefined;
  const stale = proposal.source.kind === 'workout' && (!entry || entry.deletedAt !== undefined || entry.status !== 'planned' || entry.versionId !== proposal.source.version_id);
  const canSave = pending && validation.valid && !stale;
  const sourceText = proposal.source.kind === 'workout' ? null : proposal.source.text;

  const save = async () => {
    if (busy || !canSave) return;
    setBusy('save');
    setError(null);
    if (isAdaptation && proposal.source.kind === 'workout') {
      const res = await decideProposal(proposal.id, 'approved', proposal.source.workout_id);
      if (!res.ok) {
        setError(res.message);
        setBusy(null);
        return;
      }
      applyAdaptation(proposal.source.scheduled_id, proposal.content);
      // The workout's own screen is underneath this one and now shows the new version.
      if (router.canGoBack()) router.back();
      else router.replace(`/workout-detail?id=${proposal.source.scheduled_id}`);
      return;
    }
    const workoutId = newUuid();
    const res = await decideProposal(proposal.id, 'approved', workoutId);
    if (!res.ok) {
      setError(res.message);
      setBusy(null);
      return;
    }
    const ids = createWorkout(proposal.content, { source: 'import', scheduledAt: combineDateAndTime(date, new Date()), workoutId });
    if (ids.scheduledId) router.replace(`/workout-detail?id=${ids.scheduledId}`);
    else router.back();
  };

  const revise = async () => {
    if (busy || !note.trim()) return;
    setBusy('revise');
    setError(null);
    const res = await reviseProposal(proposal.id, note.trim());
    setBusy(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setNote('');
    router.replace({ pathname: '/proposal', params: { id: res.proposal.id } });
  };

  const discard = async () => {
    if (busy) return;
    setBusy('discard');
    if (pending) await decideProposal(proposal.id, 'rejected');
    router.back();
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={isAdaptation ? strings.proposalAdaptTitle : strings.proposalImportTitle} subtitle={strings.proposalSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!pending ? (
          <Card>
            <Text style={styles.body}>
              {proposal.status === 'approved' ? strings.proposalAlreadySaved : proposal.status === 'pending_approval' ? strings.proposalExpired : strings.proposalClosed}
            </Text>
          </Card>
        ) : null}
        {pending && stale ? (
          <Card style={{ borderColor: colors.amber }}>
            <Text style={styles.body}>{strings.proposalStale}</Text>
          </Card>
        ) : null}

        {proposal.notices.map((notice) => (
          <Card key={notice.code} style={{ borderColor: colors.amber }}>
            <Text style={styles.body}>{notice.message}</Text>
          </Card>
        ))}

        {proposal.open_questions.length > 0 ? (
          <Card style={[styles.card, { borderColor: colors.amber }]}>
            <Text style={[styles.cardTitle, { color: colors.amber }]}>{strings.proposalUnsure}</Text>
            {proposal.open_questions.map((q) => (
              <Text key={q} style={styles.body}>
                • {q}
              </Text>
            ))}
          </Card>
        ) : null}

        <ValidationIssues result={validation} />

        {isAdaptation ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.proposalWhatChanges}</Text>
            {proposal.changes.map((change, i) => (
              <View key={i} style={styles.change}>
                <Text style={styles.changeWhere}>{change.where}</Text>
                {change.before ? <Text style={styles.before}>{change.before}</Text> : null}
                {change.after ? <Text style={styles.after}>{change.after}</Text> : null}
              </View>
            ))}
            {proposal.rationale.length > 0 ? (
              <>
                <Text style={[styles.cardTitle, { marginTop: spacing.sm }]}>{strings.proposalWhy}</Text>
                {proposal.rationale.map((r, i) => (
                  <Text key={i} style={styles.body}>
                    • {r.reason}
                  </Text>
                ))}
              </>
            ) : null}
          </Card>
        ) : null}

        <WorkoutSummaryView content={proposal.content} />

        {sourceText ? (
          <Card style={styles.card}>
            <TouchableOpacity style={styles.sourceToggle} onPress={() => setShowSource((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.cardTitle}>{strings.proposalOriginal}</Text>
              {showSource ? (
                <Icons.chevronUp size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
              ) : (
                <Icons.chevronDown size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
              )}
            </TouchableOpacity>
            {showSource ? <Text style={styles.source}>{sourceText}</Text> : null}
          </Card>
        ) : null}

        {pending ? (
          <>
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.proposalAskChange}</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={(v) => setNote(v.slice(0, LIMITS.noteChars))}
                placeholder={isAdaptation ? strings.proposalAskAdaptPlaceholder : strings.proposalAskImportPlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
                editable={!busy}
                accessibilityLabel={strings.proposalAskChange}
              />
              {busy === 'revise' ? (
                <View style={styles.busy}>
                  <ActivityIndicator color={colors.blue} />
                  <Text style={styles.body}>{strings.adaptWorking}</Text>
                </View>
              ) : (
                <GradientButton label={strings.proposalUpdateDraft} variant="secondary" onPress={() => void revise()} />
              )}
            </Card>

            {!isAdaptation ? (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setPickingDate(true)}>
                <Card style={styles.dateRow}>
                  <Icons.calendar size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{strings.proposalScheduleFor}</Text>
                    <Text style={styles.dateValue}>{formatDateLabel(date)}</Text>
                  </View>
                  <Icons.chevronDown size={16} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                </Card>
              </TouchableOpacity>
            ) : null}
            <DatePickerModal
              visible={pickingDate}
              date={date}
              onClose={() => setPickingDate(false)}
              onSelect={(d) => {
                setDate(d);
                setPickingDate(false);
              }}
            />
          </>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {pending ? (
          <>
            {canSave ? (
              <GradientButton label={busy === 'save' ? strings.saving : isAdaptation ? strings.proposalApply : strings.proposalSave} onPress={() => void save()} />
            ) : !validation.valid ? (
              <Text style={styles.body}>{strings.proposalCannotSave}</Text>
            ) : null}
            <GradientButton label={strings.proposalDiscard} variant="tertiary" onPress={() => void discard()} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.bold },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  change: { gap: 2, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  changeWhere: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.medium },
  before: { color: colors.textTertiary, fontSize: 13.5, lineHeight: 19, textDecorationLine: 'line-through', fontFamily: fontFamily.regular },
  after: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.semibold },
  sourceToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  source: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  input: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    minHeight: 60,
    textAlignVertical: 'top',
    padding: spacing.md,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateValue: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, marginTop: 2 },
  error: { color: colors.red, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
});
