import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { analyseSquat } from '@/lib/movement/analysis';
import { saveAnalysis, uploadClip } from '@/lib/movement/api';
import { MAX_VIDEO_BYTES, MOVEMENTS, RETENTION_DAYS, VIDEO_TYPES, type CameraView, type MovementId } from '@/lib/movement/model';
import { extractPose, poseSupported } from '@/lib/movement/pose';
import { checkAnalysis } from '@/lib/movement/validate';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

/** Choose the movement and camera, read the guide, decide the consents, then record or choose the clip. */
export default function NewClipScreen() {
  const [movementId] = useState<MovementId>('bodyweight_squat');
  const [view, setView] = useState<CameraView>('side');
  const [recording, setRecording] = useState(false);
  const [inference, setInference] = useState(poseSupported);
  const [share, setShare] = useState(false);
  const [days, setDays] = useState<number>(90);
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const movement = MOVEMENTS.find((m) => m.id === movementId)!;
  const guide = movement.views.find((v) => v.view === view)!;

  const go = async (camera: boolean) => {
    if (status) return;
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    let size = asset.fileSize ?? 0;
    let mime = asset.mimeType ?? '';
    if (!size || !mime) {
      const blob = await (await fetch(asset.uri)).blob();
      size = size || blob.size;
      mime = mime || blob.type;
    }
    if (mime === 'video/x-m4v') mime = 'video/mp4';
    if (!VIDEO_TYPES.includes(mime)) return setToast(strings.videoTypeUnsupported);
    if (size > MAX_VIDEO_BYTES) return setToast(strings.videoTooLarge);

    setStatus(strings.uploading);
    const up = await uploadClip({ movementId, view, mime, size, retentionDays: days, consentRecording: recording, consentInference: inference, share }, asset.uri, asset.duration ? asset.duration / 1000 : null);
    if (!up.ok) {
      setStatus(null);
      return setToast(up.error);
    }
    if (inference && poseSupported) {
      try {
        setStatus(strings.analysing(0));
        const pose = await extractPose(asset.uri, (f) => setStatus(strings.analysing(Math.round(f * 100))));
        const analysis = analyseSquat(pose, view);
        if (!checkAnalysis(analysis)) {
          const saved = await saveAnalysis(up.data.id, analysis);
          if (!saved.ok) setToast(saved.error);
        }
      } catch {
        setToast(strings.analysisFailed);
      }
    }
    setStatus(null);
    router.replace({ pathname: '/movement-clip', params: { id: up.data.id } });
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.newClip} subtitle={movement.name} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>{strings.cameraView}</Text>
        <SegmentedTabs options={movement.views.map((v) => ({ key: v.view, label: v.title }))} value={view} onChange={(k) => setView(k as CameraView)} size="sm" />
        <Card style={styles.card}>
          <Text style={styles.title}>{strings.cameraGuide}</Text>
          {guide.guide.map((g) => (
            <Text key={g} style={styles.body}>{`• ${g}`}</Text>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>{strings.consentsTitle}</Text>
          <Toggle label={strings.consentRecording} hint={strings.consentRecordingHint} value={recording} onChange={setRecording} />
          <Toggle label={strings.consentInference} hint={poseSupported ? strings.consentInferenceHint : strings.movementWebOnly} value={inference} onChange={setInference} />
          <Toggle label={strings.consentShare} hint={strings.consentShareHint} value={share} onChange={setShare} />
          <Text style={styles.hint}>{strings.consentResearch}</Text>
          <Text style={styles.label}>{strings.keepFor}</Text>
          <SegmentedTabs options={RETENTION_DAYS.map((d) => ({ key: String(d), label: strings.keepDays(d) }))} value={String(days)} onChange={(k) => setDays(Number(k))} size="sm" />
        </Card>

        {status ? (
          <Text style={styles.status}>{status}</Text>
        ) : (
          <>
            {Platform.OS !== 'web' ? <GradientButton label={strings.recordVideo} onPress={recording ? () => void go(true) : undefined} /> : null}
            <GradientButton label={strings.chooseVideo} variant={Platform.OS === 'web' ? 'primary' : 'secondary'} onPress={recording ? () => void go(false) : undefined} />
          </>
        )}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: colors.teal, false: colors.cardAlt }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  toggleLabel: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
  status: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold, textAlign: 'center', paddingVertical: spacing.md },
});
