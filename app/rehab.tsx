import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EpisodeForm } from '@/components/rehab/EpisodeForm';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { BODY_REGION_LABEL, EPISODE_STATUS_LABEL } from '@/lib/rehab/model';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

export default function RehabScreen() {
  const episodes = useWorkoutsStore((s) => s.episodes);
  const clinical = useWorkoutsStore((s) => s.clinical);
  const addEpisode = useWorkoutsStore((s) => s.addEpisode);
  const [adding, setAdding] = useState(false);

  const list = Object.values(episodes)
    .filter((e) => !e.deletedAt)
    .sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || b.updatedAt - a.updatedAt);

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.rehabTitle} subtitle={strings.rehabSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{strings.rehabNotDiagnosis}</Text>
        {list.length === 0 && !adding ? <Text style={styles.body}>{strings.noEpisodes}</Text> : null}
        {list.map((e) => {
          const active = clinical.restrictions.filter((r) => r.episodeId === e.id && r.status === 'active').length;
          const side = e.laterality === 'left' ? strings.sideLeft : e.laterality === 'right' ? strings.sideRight : e.laterality === 'both' ? strings.sideBoth : '';
          return (
            <TouchableOpacity key={e.id} activeOpacity={0.75} onPress={() => router.push({ pathname: '/rehab-case', params: { id: e.id } })}>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{[BODY_REGION_LABEL[e.bodyRegion], side.toLowerCase()].filter(Boolean).join(', ')}</Text>
                  <Text style={styles.meta}>{[EPISODE_STATUS_LABEL[e.status], active ? strings.restrictionsCount(active) : undefined].filter(Boolean).join(' · ')}</Text>
                  <Text style={styles.body} numberOfLines={2}>
                    {e.reportedProblem}
                  </Text>
                </View>
                <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
              </Card>
            </TouchableOpacity>
          );
        })}
        {adding ? (
          <EpisodeForm
            onCancel={() => setAdding(false)}
            onSave={(input) => {
              const res = addEpisode(input);
              if (res.ok) {
                setAdding(false);
                router.push({ pathname: '/rehab-case', params: { id: res.episodeId } });
              }
              return res;
            }}
          />
        ) : (
          <GradientButton label={strings.noteInjury} icon={<Icons.plus size={16} color="#fff" strokeWidth={iconStrokeWidth} />} onPress={() => setAdding(true)} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
});
