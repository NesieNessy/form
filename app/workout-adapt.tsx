import { DraftStatus } from '@/components/ui/DraftStatus';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Stepper } from '@/components/ui/Stepper';
import { requestAdaptation } from '@/lib/ai/client';
import { LIMITS, type AdaptConstraints } from '@/lib/ai/pipeline';
import { EQUIPMENT_OPTIONS } from '@/lib/athlete/model';
import { useAuthStore } from '@/lib/auth';
import { strings } from '@/lib/strings';
import { syncNow } from '@/lib/sync';
import { useScheduleItem } from '@/lib/useWorkouts';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

const EQUIPMENT_CHIPS = EQUIPMENT_OPTIONS.map((e) => ({ key: e, label: e.charAt(0).toUpperCase() + e.slice(1) }));
const DIFFICULTY = [
  { key: 'keep', label: strings.keepAsIs },
  { key: 'easier', label: strings.easier },
  { key: 'harder', label: strings.harder },
];
const VOLUME = [
  { key: 'keep', label: strings.keepAsIs },
  { key: 'less', label: strings.lessVolume },
  { key: 'more', label: strings.moreVolume },
];

/** Choose what to adapt a planned workout for; the assistant answers with a proposal to review. */
export default function WorkoutAdaptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useScheduleItem(id);
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const profileEquipment = useWorkoutsStore((s) => s.profile.equipment);

  const [limitEquipment, setLimitEquipment] = useState(false);
  const [equipment, setEquipment] = useState<string[]>(profileEquipment);
  const [minutes, setMinutes] = useState(0);
  const [difficulty, setDifficulty] = useState('keep');
  const [volume, setVolume] = useState('keep');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !id) return;
    const constraints: AdaptConstraints = {};
    if (limitEquipment) constraints.equipment = equipment;
    if (minutes > 0) constraints.maxMinutes = minutes;
    if (difficulty === 'easier' || difficulty === 'harder') constraints.difficulty = difficulty;
    if (volume === 'less' || volume === 'more') constraints.volume = volume;
    if (note.trim()) constraints.note = note.trim();
    if (Object.keys(constraints).length === 0) {
      setError(strings.adaptChooseSomething);
      return;
    }

    setBusy(true);
    setError(null);
    // The assistant reads the workout from the account, so local changes go up first.
    await syncNow().catch(() => {});
    const res = await requestAdaptation(id, constraints);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.replace({ pathname: '/proposal', params: { id: res.proposal.id } });
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.adaptTitle} subtitle={item?.version.content.title ?? strings.adaptSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!signedIn || !item ? (
          <Card>
            <Text style={styles.body}>{signedIn ? strings.workoutNotFound : strings.assistantNeedsAccount}</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{strings.adaptEquipment}</Text>
                  <Text style={styles.body}>{strings.adaptEquipmentBody}</Text>
                </View>
                <Switch
                  value={limitEquipment}
                  onValueChange={setLimitEquipment}
                  trackColor={{ true: colors.blue, false: colors.border }}
                  thumbColor={colors.text}
                  accessibilityLabel={strings.adaptEquipment}
                />
              </View>
              {limitEquipment ? (
                <ChipSelect
                  options={EQUIPMENT_CHIPS}
                  selected={equipment}
                  onToggle={(e) => setEquipment((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]))}
                />
              ) : null}
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.adaptTime}</Text>
              <Stepper value={minutes} onChange={setMinutes} min={0} max={300} step={5} suffix={minutes > 0 ? strings.min : `· ${strings.noLimit}`} />
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.adaptDifficulty}</Text>
              <SegmentedTabs options={DIFFICULTY} value={difficulty} onChange={setDifficulty} size="sm" />
              <Text style={[styles.cardTitle, { marginTop: spacing.sm }]}>{strings.adaptVolume}</Text>
              <SegmentedTabs options={VOLUME} value={volume} onChange={setVolume} size="sm" />
            </Card>

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.adaptNote}</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={(v) => setNote(v.slice(0, LIMITS.noteChars))}
                placeholder={strings.adaptNotePlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
                editable={!busy}
                accessibilityLabel={strings.adaptNote}
              />
            </Card>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            {busy ? (
              <Card style={styles.busy}>
                <DraftStatus state="working" />
                <Text style={styles.body}>{strings.adaptWorking}</Text>
              </Card>
            ) : (
              <GradientButton label={strings.adaptCreateDraft} onPress={() => void submit()} />
            )}

            <Text style={styles.footnote}>{strings.assistantFootnote}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.bold },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  input: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    minHeight: 70,
    textAlignVertical: 'top',
    padding: spacing.md,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  error: { color: colors.red, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  footnote: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, fontFamily: fontFamily.regular },
});
