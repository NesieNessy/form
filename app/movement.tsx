import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { useAuthStore } from '@/lib/auth';
import { myClips, purgeExpiredClips, type Clip } from '@/lib/movement/api';
import { movementName, viewTitle } from '@/lib/movement/model';
import { poseSupported } from '@/lib/movement/pose';
import { strings, locale } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

export default function MovementScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [clips, setClips] = useState<Clip[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) return;
      void (async () => {
        await purgeExpiredClips();
        const res = await myClips();
        if (res.ok) setClips(res.data);
      })();
    }, [signedIn])
  );

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.movementTitle} subtitle={strings.movementSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!signedIn ? (
          <Card>
            <Text style={styles.body}>{strings.movementNeedsAccount}</Text>
          </Card>
        ) : (
          <>
            {!poseSupported ? <Text style={styles.hint}>{strings.movementWebOnly}</Text> : null}
            {clips?.length === 0 ? <Text style={styles.body}>{strings.movementNoClips}</Text> : null}
            {clips?.map((c) => (
              <TouchableOpacity key={c.id} activeOpacity={0.75} onPress={() => router.push({ pathname: '/movement-clip', params: { id: c.id } })}>
                <Card style={styles.row}>
                  <Icons.video size={18} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{`${movementName(c.movement_id)} · ${viewTitle(c.movement_id, c.camera_view).toLowerCase()}`}</Text>
                    <Text style={styles.meta}>
                      {[
                        new Date(c.created_at).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
                        c.analysis ? (c.analysis.usable ? strings.observations.toLowerCase() : strings.cannotAssess.toLowerCase()) : undefined,
                        c.annotations.length ? `${c.annotations.length} ${strings.clipNotes.toLowerCase()}` : undefined,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                </Card>
              </TouchableOpacity>
            ))}
            <GradientButton label={strings.newClip} icon={<Icons.plus size={16} color={colors.onAction} strokeWidth={iconStrokeWidth} />} onPress={() => router.push('/movement-new')} />
          </>
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
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
});
