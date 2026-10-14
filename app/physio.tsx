import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { useAuthStore } from '@/lib/auth';
import { listCases, type SharedCase } from '@/lib/rehab/api';
import { BODY_REGION_LABEL, EPISODE_STATUS_LABEL } from '@/lib/rehab/model';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** Cases athletes shared with the signed-in physiotherapist. Opening the list is logged per case. */
export default function PhysioScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [cases, setCases] = useState<SharedCase[]>([]);
  const [verified, setVerified] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      listCases().then((res) => {
        if (res.ok) {
          setCases(res.data.cases);
          setVerified(res.data.verified);
        } else setError(res.error);
        setLoaded(true);
      });
    }, [signedIn])
  );

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.physioTitle} subtitle={strings.physioSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!signedIn ? <Text style={styles.body}>{strings.coachingNeedsAccount}</Text> : null}
        {loaded ? <Text style={styles.hint}>{verified ? strings.verifiedBanner : strings.unverifiedBanner}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loaded && cases.length === 0 ? <Text style={styles.body}>{strings.noCases}</Text> : null}
        {cases.map((c) => (
          <TouchableOpacity key={c.episode.id} activeOpacity={0.75} onPress={() => router.push({ pathname: '/physio-case', params: { episodeId: c.episode.id } })}>
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{c.athlete.name ?? strings.someone}</Text>
                <Text style={styles.meta}>{`${BODY_REGION_LABEL[c.episode.bodyRegion]} · ${EPISODE_STATUS_LABEL[c.episode.status]}`}</Text>
                <Text style={styles.body} numberOfLines={2}>
                  {c.episode.reportedProblem}
                </Text>
              </View>
              <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
            </Card>
          </TouchableOpacity>
        ))}
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
  error: { color: colors.red, fontSize: 13, fontFamily: fontFamily.regular },
});
