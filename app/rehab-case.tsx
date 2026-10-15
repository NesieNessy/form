import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { DatePickerModal } from '@/components/workout/DatePickerModal';
import { FieldCard } from '@/components/workout/FieldCard';
import { WorkoutSummaryView } from '@/components/workout/WorkoutSummaryView';
import { useAuthStore } from '@/lib/auth';
import { formatDateLabel } from '@/lib/date';
import { caseSharing, revokeCase, shareCase } from '@/lib/rehab/api';
import { ESCALATION_MESSAGE, needsPromptCare } from '@/lib/rehab/conflicts';
import { BODY_REGION_LABEL, EPISODE_STATUS_LABEL, RED_FLAGS, RTS_LABEL, RULE_LABEL, TAG_LABEL, TAG_ORDER, type EpisodeStatus, type Issuer, type RedFlag } from '@/lib/rehab/model';
import { listRelationships, type Relationship } from '@/lib/sharing/api';
import { strings, locale } from '@/lib/strings';
import { syncNow } from '@/lib/sync';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

const SCALE = Array.from({ length: 11 }, (_, i) => ({ key: String(i), label: String(i) }));
const STATUSES = (Object.keys(EPISODE_STATUS_LABEL) as EpisodeStatus[]).map((k) => ({ key: k, label: EPISODE_STATUS_LABEL[k] }));
const day = (ms: number) => new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
const who = (i: Issuer) => `${i.name ?? strings.someone} · ${i.role}, ${i.verified ? strings.verifiedClinician : strings.unverifiedClinician}`;

export default function RehabCaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const episode = useWorkoutsStore((s) => s.episodes[id]);
  const symptomLogs = useWorkoutsStore((s) => s.symptomLogs);
  const clinical = useWorkoutsStore((s) => s.clinical);
  const updateEpisode = useWorkoutsStore((s) => s.updateEpisode);
  const removeEpisode = useWorkoutsStore((s) => s.removeEpisode);
  const addSymptomLog = useWorkoutsStore((s) => s.addSymptomLog);
  const addFromRehabPlan = useWorkoutsStore((s) => s.addFromRehabPlan);

  const [intensity, setIntensity] = useState<number | undefined>(undefined);
  const [fn, setFn] = useState<number | undefined>(undefined);
  const [context, setContext] = useState('');
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [escalate, setEscalate] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [physios, setPhysios] = useState<Relationship[]>([]);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const loadSharing = useCallback(async () => {
    if (!signedIn) return;
    const [rel, access] = await Promise.all([listRelationships(), caseSharing()]);
    if (rel.ok) setPhysios(rel.data.filter((r) => r.role === 'athlete' && r.relationship_type === 'physiotherapist' && r.status === 'active'));
    if (access.ok) setSharedWith(access.data.filter((a) => a.episode_id === id).map((a) => a.relationship_id));
  }, [signedIn, id]);

  useEffect(() => {
    void loadSharing();
  }, [loadSharing]);

  if (!episode || episode.deletedAt) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.rehabTitle} />
        <Text style={[styles.body, { padding: spacing.xl }]}>{strings.entryNotFound}</Text>
      </View>
    );
  }

  const logs = Object.values(symptomLogs).filter((l) => l.episodeId === id && !l.deletedAt).sort((a, b) => b.loggedAt - a.loggedAt);
  const restrictions = clinical.restrictions.filter((r) => r.episodeId === id);
  const plan = clinical.plans.filter((p) => p.episodeId === id && p.status === 'published').sort((a, b) => b.version - a.version)[0];
  const decisions = clinical.decisions.filter((d) => d.episodeId === id);
  const notes = clinical.notes.filter((n) => n.episodeId === id);
  const side = episode.laterality === 'left' ? strings.sideLeft : episode.laterality === 'right' ? strings.sideRight : episode.laterality === 'both' ? strings.sideBoth : '';
  // A red flag in the latest entry takes precedence over everything else on the screen.
  const urgent = escalate || (logs[0] ? needsPromptCare(logs[0]) : false);

  return (
    <View style={styles.screen}>
      <DetailHeader title={[BODY_REGION_LABEL[episode.bodyRegion], side.toLowerCase()].filter(Boolean).join(', ')} subtitle={episode.reportedProblem} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {urgent ? (
          <Card style={[styles.card, styles.urgent]}>
            <Text style={styles.urgentText}>{ESCALATION_MESSAGE}</Text>
          </Card>
        ) : null}

        <Card style={styles.card}>
          <Text style={styles.label}>{strings.caseStatus}</Text>
          <SegmentedTabs options={STATUSES} value={episode.status} onChange={(k) => updateEpisode(id, { status: k as EpisodeStatus })} scrollable size="sm" />
          <Text style={styles.label}>{strings.whatToAvoid}</Text>
          <ChipSelect
            options={TAG_ORDER.map((t) => ({ key: t, label: TAG_LABEL[t] }))}
            selected={episode.affectedActivities}
            onToggle={(t) => updateEpisode(id, { affectedActivities: episode.affectedActivities.includes(t) ? episode.affectedActivities.filter((x) => x !== t) : [...episode.affectedActivities, t] })}
          />
          <Text style={styles.hint}>{strings.rehabNotDiagnosis}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.logSymptoms}</Text>
          <Text style={styles.label}>{strings.symptomIntensity}</Text>
          <SegmentedTabs options={SCALE} value={intensity !== undefined ? String(intensity) : ''} onChange={(k) => setIntensity(Number(k))} scrollable size="sm" />
          <Text style={styles.label}>{strings.symptomFunction}</Text>
          <SegmentedTabs options={SCALE} value={fn !== undefined ? String(fn) : ''} onChange={(k) => setFn(Number(k))} scrollable size="sm" />
          <FieldCard label={strings.symptomContext} value={context} onChangeText={setContext} placeholder={strings.symptomContextPlaceholder} cardStyle={styles.inset} />
          <Text style={styles.label}>{strings.redFlagsTitle}</Text>
          {(Object.keys(RED_FLAGS) as RedFlag[]).map((f) => {
            const on = flags.includes(f);
            return (
              <TouchableOpacity key={f} style={styles.toggle} onPress={() => setFlags((cur) => (on ? cur.filter((x) => x !== f) : [...cur, f]))} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[styles.box, on && styles.boxOn]} />
                <Text style={styles.toggleText}>{RED_FLAGS[f]}</Text>
              </TouchableOpacity>
            );
          })}
          <GradientButton
            label={strings.saveLog}
            onPress={() => {
              if (intensity === undefined) return setToast(strings.symptomIntensity);
              const res = addSymptomLog(id, { intensity, function: fn, context, redFlags: flags });
              if (!res.ok) return setToast(res.error);
              setEscalate(flags.length > 0);
              setIntensity(undefined);
              setFn(undefined);
              setContext('');
              setFlags([]);
              setToast(strings.checkInSaved);
            }}
          />
          {logs.length ? <Text style={styles.label}>{strings.recentSymptoms}</Text> : null}
          {logs.slice(0, 8).map((l) => (
            <View key={l.id} style={styles.line}>
              <Text style={styles.meta}>{day(l.loggedAt)}</Text>
              <Text style={[styles.lineValue, l.redFlags.length > 0 && styles.flagged]}>
                {[`${l.intensity}/10`, l.function !== undefined ? `function ${l.function}/10` : undefined, l.context].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </Card>

        <Text style={styles.sectionTitle}>{strings.fromYourPhysio}</Text>
        {!restrictions.length && !plan && !decisions.length && !notes.length ? <Text style={styles.hint}>{strings.noClinicalYet}</Text> : null}
        {restrictions.map((r) => (
          <Card key={r.id} style={[styles.card, r.status === 'lifted' && styles.dim]}>
            <Text style={styles.cardTitle}>{`${RULE_LABEL[r.rule]}: ${r.tags.map((t) => TAG_LABEL[t].toLowerCase()).join(', ')}`}</Text>
            <Text style={styles.meta}>{[r.status === 'lifted' ? strings.lifted : r.expiresOn ? strings.restrictionUntil(r.expiresOn) : undefined, who(r.issuer)].filter(Boolean).join(' · ')}</Text>
            {r.note ? <Text style={styles.body}>{r.note}</Text> : null}
          </Card>
        ))}
        {plan && !urgent ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{`${strings.rehabPlan} · v${plan.version}`}</Text>
            <Text style={styles.meta}>{[plan.sessionsPerWeek ? strings.rehabSessionsPerWeek(plan.sessionsPerWeek) : undefined, who(plan.author)].filter(Boolean).join(' · ')}</Text>
            {plan.notes ? <Text style={styles.body}>{plan.notes}</Text> : null}
            <WorkoutSummaryView content={plan.content} dateTimeMs={plan.createdAt} />
            <Text style={styles.hint}>{strings.rehabPlanDoseNote}</Text>
            <TouchableOpacity style={styles.line} onPress={() => setPickingDate(true)}>
              <Text style={styles.label}>{strings.addSessionOn}</Text>
              <Text style={styles.lineValue}>{formatDateLabel(sessionDate)}</Text>
            </TouchableOpacity>
            <DatePickerModal visible={pickingDate} date={sessionDate} onClose={() => setPickingDate(false)} onSelect={(d) => (setSessionDate(d), setPickingDate(false))} />
            <GradientButton
              label={strings.addToMyCalendar}
              variant="secondary"
              onPress={() => {
                const at = new Date(sessionDate);
                at.setHours(17, 0, 0, 0);
                addFromRehabPlan(plan.content, at.getTime());
                setToast(strings.addedToCalendar);
              }}
            />
          </Card>
        ) : null}
        {decisions.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.rtsTitle}</Text>
            {decisions.map((d) => (
              <View key={d.id} style={{ gap: 2 }}>
                <Text style={styles.body}>{`${RTS_LABEL[d.stage]} · ${day(d.decidedAt)}`}</Text>
                <Text style={styles.meta}>{`${d.criteria} · ${who(d.clinician)}`}</Text>
              </View>
            ))}
          </Card>
        ) : null}
        {notes.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.reviewNotes}</Text>
            {notes.map((n) => (
              <View key={n.id} style={{ gap: 2 }}>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.meta}>{`${day(n.createdAt)} · ${who(n.author)}`}</Text>
              </View>
            ))}
          </Card>
        ) : null}
        {signedIn ? <GradientButton label={strings.refresh} variant="tertiary" onPress={() => void syncNow()} /> : null}

        {signedIn ? (
          <>
            <Text style={styles.sectionTitle}>{strings.careTeam}</Text>
            <Text style={styles.hint}>{strings.careTeamHint}</Text>
            {physios.length === 0 ? <Text style={styles.body}>{strings.noPhysios}</Text> : null}
            {physios.map((p) => {
              const shared = sharedWith.includes(p.id);
              return (
                <Card key={p.id} style={[styles.card, styles.shareRow]}>
                  <Text style={[styles.cardTitle, { flex: 1 }]}>{p.counterpart_name ?? strings.someone}</Text>
                  <GradientButton
                    label={shared ? strings.stopSharing : strings.shareThisCase}
                    variant={shared ? 'tertiary' : 'secondary'}
                    style={{ minWidth: 120 }}
                    onPress={async () => {
                      if (!shared) await syncNow(); // the case must be on the server first
                      const res = shared ? await revokeCase(id, p.id) : await shareCase(id, p.id);
                      if (!res.ok) setToast(res.error);
                      await loadSharing();
                    }}
                  />
                </Card>
              );
            })}
          </>
        ) : null}

        {confirmingDelete ? (
          <Card style={styles.card}>
            <Text style={styles.body}>{strings.confirmDeleteCase}</Text>
            <View style={styles.row}>
              <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmingDelete(false)} />
              <GradientButton
                label={strings.deleteCase}
                variant="danger"
                style={{ flex: 1 }}
                onPress={() => {
                  removeEpisode(id);
                  router.back();
                }}
              />
            </View>
          </Card>
        ) : (
          <GradientButton label={strings.deleteCase} variant="tertiary" onPress={() => setConfirmingDelete(true)} />
        )}
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
  urgent: { borderColor: colors.red, backgroundColor: `${colors.red}18` },
  urgentText: { color: colors.text, fontSize: 14, lineHeight: 20, fontFamily: fontFamily.semibold },
  dim: { opacity: 0.6 },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textTertiary },
  boxOn: { backgroundColor: colors.red, borderColor: colors.red },
  toggleText: { color: colors.text, fontSize: 13.5, flex: 1, fontFamily: fontFamily.regular },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  lineValue: { flexShrink: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontFamily: fontFamily.semibold },
  flagged: { color: colors.red },
  shareRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
});
