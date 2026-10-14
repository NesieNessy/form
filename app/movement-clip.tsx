import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AnalysisView } from '@/components/movement/AnalysisView';
import { ClipNotes } from '@/components/movement/ClipNotes';
import { ClipPlayer, type ClipPlayerHandle } from '@/components/movement/ClipPlayer';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { FieldCard } from '@/components/workout/FieldCard';
import { analyseSquat } from '@/lib/movement/analysis';
import { clipLink, deleteClip, myClips, requestClipReview, saveAnalysis, setClipConsent, type Clip } from '@/lib/movement/api';
import { movementName, viewTitle } from '@/lib/movement/model';
import { extractPose, poseSupported } from '@/lib/movement/pose';
import { checkAnalysis } from '@/lib/movement/validate';
import { listRelationships, type Relationship } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function ClipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const player = useRef<ClipPlayerHandle>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [reviewers, setReviewers] = useState<Relationship[]>([]);
  const [reviewer, setReviewer] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    const res = await myClips();
    if (!res.ok) return setToast(res.error);
    const c = res.data.find((x) => x.id === id) ?? null;
    setClip(c);
    if (c) setLink(await clipLink(c.storage_path));
    const rel = await listRelationships();
    if (rel.ok) {
      const withVideo = rel.data.filter((r) => r.role === 'athlete' && r.status === 'active' && r.grants.some((g) => g.data_category === 'video'));
      setReviewers(withVideo);
      setReviewer((cur) => cur || withVideo[0]?.id || '');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!clip) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.movementTitle} />
      </View>
    );
  }

  const analyse = async () => {
    if (!link || status) return;
    try {
      setStatus(strings.analysing(0));
      const pose = await extractPose(link, (f) => setStatus(strings.analysing(Math.round(f * 100))));
      const a = analyseSquat(pose, clip.camera_view);
      const problem = checkAnalysis(a);
      if (problem) setToast(problem);
      else {
        const res = await saveAnalysis(clip.id, a);
        if (!res.ok) setToast(res.error);
      }
    } catch {
      setToast(strings.analysisFailed);
    }
    setStatus(null);
    await load();
  };

  const consent = async (inference: boolean | null, share: boolean | null) => {
    const res = await setClipConsent(clip.id, inference, share);
    if (!res.ok) setToast(res.error);
    await load();
  };

  return (
    <View style={styles.screen}>
      <DetailHeader
        title={movementName(clip.movement_id)}
        subtitle={`${viewTitle(clip.movement_id, clip.camera_view)} · ${new Date(clip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ClipPlayer ref={player} uri={link} />

        {clip.analysis ? <AnalysisView analysis={clip.analysis} onSeek={(s) => player.current?.seek(s)} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {!clip.consent_inference ? (
          <Text style={styles.hint}>{strings.analysisOff}</Text>
        ) : poseSupported && !status ? (
          <GradientButton label={clip.analysis ? strings.analyseAgain : strings.analyse} variant="secondary" onPress={() => void analyse()} />
        ) : null}

        <ClipNotes
          clipId={clip.id}
          notes={clip.annotations}
          currentTime={() => player.current?.currentTime() ?? 0}
          onSeek={(s) => player.current?.seek(s)}
          onAdded={() => void load()}
          onError={setToast}
        />

        <Card style={styles.card}>
          <Text style={styles.title}>{strings.consentsTitle}</Text>
          <Row label={strings.consentInference} value={clip.consent_inference} onChange={(v) => void consent(v, null)} />
          <Row label={strings.consentShare} value={clip.shared_with_professionals} onChange={(v) => void consent(null, v)} />
          <Text style={styles.hint}>{strings.consentShareHint}</Text>
          <Text style={styles.hint}>{strings.keptUntil(clip.retention_until)}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>{strings.askForReview}</Text>
          {clip.review_requests.map((r) => (
            <Text key={r.id} style={styles.meta}>
              {r.status === 'answered' ? strings.reviewAnswered(r.professional_name ?? strings.someone) : strings.reviewOpen(r.professional_name ?? strings.someone)}
            </Text>
          ))}
          {reviewers.length === 0 ? (
            <Text style={styles.body}>{strings.noVideoGrants}</Text>
          ) : (
            <>
              <SegmentedTabs options={reviewers.map((r) => ({ key: r.id, label: r.counterpart_name ?? strings.someone }))} value={reviewer} onChange={setReviewer} scrollable size="sm" />
              <FieldCard label={strings.reviewNote} value={reviewNote} onChangeText={setReviewNote} maxLength={500} cardStyle={styles.inset} />
              <GradientButton
                label={strings.askForReview}
                variant="secondary"
                onPress={async () => {
                  const res = await requestClipReview(clip.id, reviewer, reviewNote);
                  if (!res.ok) return setToast(res.error);
                  setReviewNote('');
                  setToast(strings.reviewRequested);
                  await load();
                }}
              />
            </>
          )}
        </Card>

        {confirmDelete ? (
          <Card style={styles.card}>
            <Text style={styles.body}>{strings.deleteClipConfirm}</Text>
            <View style={styles.row}>
              <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmDelete(false)} />
              <GradientButton
                label={strings.deleteClip}
                style={{ flex: 1 }}
                onPress={async () => {
                  const res = await deleteClip(clip);
                  if (!res.ok) return setToast(res.error);
                  router.back();
                }}
              />
            </View>
          </Card>
        ) : (
          <GradientButton label={strings.deleteClip} variant="tertiary" onPress={() => setConfirmDelete(true)} />
        )}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.body, { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.teal, false: colors.cardAlt }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  meta: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  status: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, textAlign: 'center' },
});
