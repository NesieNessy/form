import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { Toast } from '@/components/ui/Toast';
import { FieldCard } from '@/components/workout/FieldCard';
import { useAuthStore } from '@/lib/auth';
import { acceptStudioInvite, createStudio, myOrganizations } from '@/lib/studio/api';
import { ROLE_LABEL, type Organization } from '@/lib/studio/model';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** The studios the person belongs to, joining by code, and creating one. */
export default function StudiosScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [facility, setFacility] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    if (!signedIn) return;
    const res = await myOrganizations();
    if (res.ok) setOrgs(res.data.filter((o) => o.kind === 'studio'));
    else setToast(res.error);
    setLoaded(true);
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const open = (id: string) => router.push({ pathname: '/studio-org', params: { id } });

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.studioTitle} subtitle={strings.studioSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!signedIn ? (
          <Card>
            <Text style={styles.body}>{strings.studioNeedsAccount}</Text>
          </Card>
        ) : (
          <>
            <Text style={styles.hint}>{strings.studioPrivacyNote}</Text>
            {loaded && orgs.length === 0 ? <Text style={styles.body}>{strings.noStudios}</Text> : null}
            {orgs.map((o) => (
              <TouchableOpacity key={o.id} activeOpacity={0.75} onPress={() => open(o.id)} accessibilityLabel={o.name}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{o.name}</Text>
                    <Text style={styles.meta}>{[ROLE_LABEL[o.role], o.membership ? o.membership.plan : undefined].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                </Card>
              </TouchableOpacity>
            ))}

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.joinStudio}</Text>
              <Text style={styles.body}>{strings.joinStudioBody}</Text>
              <FieldCard label={strings.inviteCode} value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={20} cardStyle={styles.inset} />
              <GradientButton
                label={busy ? strings.saving : strings.join}
                variant="secondary"
                onPress={
                  code.trim() && !busy
                    ? async () => {
                        setBusy(true);
                        const res = await acceptStudioInvite(code);
                        setBusy(false);
                        if (!res.ok) return setToast(res.error);
                        setCode('');
                        await load();
                        open(res.data);
                      }
                    : undefined
                }
              />
            </Card>

            {creating ? (
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{strings.createStudio}</Text>
                <FieldCard label={strings.studioName} value={name} onChangeText={setName} maxLength={80} cardStyle={styles.inset} />
                <FieldCard label={strings.facilityName} value={facility} onChangeText={setFacility} maxLength={80} cardStyle={styles.inset} />
                <View style={styles.buttons}>
                  <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setCreating(false)} />
                  <GradientButton
                    label={busy ? strings.saving : strings.create}
                    style={{ flex: 1 }}
                    onPress={
                      name.trim() && !busy
                        ? async () => {
                            setBusy(true);
                            const res = await createStudio(name, facility);
                            setBusy(false);
                            if (!res.ok) return setToast(res.error);
                            setCreating(false);
                            setName('');
                            setFacility('');
                            await load();
                            open(res.data);
                          }
                        : undefined
                    }
                  />
                </View>
              </Card>
            ) : (
              <GradientButton label={strings.createStudio} variant="tertiary" onPress={() => setCreating(true)} />
            )}
          </>
        )}
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { gap: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
});
