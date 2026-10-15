import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FieldCard } from '@/components/workout/FieldCard';
import { BODY_REGIONS, BODY_REGION_LABEL, TAG_LABEL, TAG_ORDER, type ActivityTag, type BodyRegion, type InjuryEpisode, type Laterality } from '@/lib/rehab/model';
import type { EpisodeInput } from '@/lib/rehab/state';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

const SIDES: { key: Laterality; label: string }[] = [
  { key: 'left', label: strings.sideLeft },
  { key: 'right', label: strings.sideRight },
  { key: 'both', label: strings.sideBoth },
  { key: 'none', label: strings.sideNone },
];
const ONSETS: { key: InjuryEpisode['onsetType']; label: string }[] = [
  { key: 'sudden', label: strings.onsetSudden },
  { key: 'gradual', label: strings.onsetGradual },
  { key: 'unknown', label: strings.onsetUnknown },
];

type Props = { onSave: (input: EpisodeInput) => { ok: boolean; error?: string }; onCancel: () => void };

/** Noting an injury in the athlete's own words. No diagnosis is asked for or offered. */
export function EpisodeForm({ onSave, onCancel }: Props) {
  const [region, setRegion] = useState<BodyRegion>('knee');
  const [side, setSide] = useState<Laterality>('none');
  const [onset, setOnset] = useState<InjuryEpisode['onsetType']>('unknown');
  const [problem, setProblem] = useState('');
  const [tags, setTags] = useState<ActivityTag[]>([]);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{strings.whereIsIt}</Text>
      <SegmentedTabs options={BODY_REGIONS.map((r) => ({ key: r, label: BODY_REGION_LABEL[r] }))} value={region} onChange={(k) => setRegion(k as BodyRegion)} scrollable size="sm" />
      <Text style={styles.label}>{strings.whichSide}</Text>
      <SegmentedTabs options={SIDES} value={side} onChange={(k) => setSide(k as Laterality)} size="sm" />
      <Text style={styles.label}>{strings.howDidItStart}</Text>
      <SegmentedTabs options={ONSETS} value={onset} onChange={(k) => setOnset(k as InjuryEpisode['onsetType'])} size="sm" />
      <FieldCard label={strings.inYourWords} value={problem} onChangeText={setProblem} placeholder={strings.inYourWordsPlaceholder} maxLength={500} multiline cardStyle={styles.inset} />
      <Text style={styles.label}>{strings.whatToAvoid}</Text>
      <ChipSelect options={TAG_ORDER.map((t) => ({ key: t, label: TAG_LABEL[t] }))} selected={tags} onToggle={(t) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={onCancel} />
        <GradientButton
          label={strings.saveCase}
          style={{ flex: 1 }}
          onPress={() => {
            const res = onSave({ bodyRegion: region, laterality: side, onsetType: onset, reportedProblem: problem, affectedActivities: tags });
            if (!res.ok) setError(res.error ?? null);
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium, marginTop: spacing.xs },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  error: { color: colors.red, fontSize: 13, fontFamily: fontFamily.regular },
});
