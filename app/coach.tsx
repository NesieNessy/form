import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { FieldCard } from '@/components/workout/FieldCard';
import { useAuthStore } from '@/lib/auth';
import { rosterNotes, sortRoster } from '@/lib/coaching/roster';
import { RELATIONSHIP_TYPES, coachRoster, inviteAthlete, listRelationships, relationshipLabel, type Relationship, type RelationshipType, type RosterRow } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** The professional's workspace: roster, invitations. Each athlete opens in coach-athlete. */
export default function CoachScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [invites, setInvites] = useState<Relationship[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [type, setType] = useState<RelationshipType>('training_coach');
  const [lastCode, setLastCode] = useState<{ email: string; code: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    if (!signedIn) return;
    const [r, rel] = await Promise.all([coachRoster(), listRelationships()]);
    if (r.ok) setRoster(sortRoster(r.data, Date.now()));
    else setToast(r.error);
    if (rel.ok) setInvites(rel.data.filter((x) => x.role === 'professional' && x.status === 'invited'));
    setLoaded(true);
  }, [signedIn]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const invite = async () => {
    if (busy) return;
    setBusy(true);
    const res = await inviteAthlete(email, type);
    setBusy(false);
    if (!res.ok) return setToast(res.error);
    setLastCode({ email: email.trim(), code: res.data.invite_code });
    setEmail('');
    await load();
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.coachingTitle} subtitle={strings.coachingSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!signedIn ? (
          <Card>
            <Text style={styles.body}>{strings.coachingNeedsAccount}</Text>
          </Card>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{strings.rosterTitle}</Text>
            <Text style={styles.hint}>{strings.rosterSummaryNote}</Text>
            {loaded && roster.length === 0 ? <Text style={styles.body}>{strings.rosterEmpty}</Text> : null}
            {roster.map((r) => (
              <TouchableOpacity
                key={r.relationship_id}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: '/coach-athlete', params: { athleteId: r.athlete_id, relationshipId: r.relationship_id } })}
              >
                <Card style={styles.card}>
                  <View style={styles.rowHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{r.athlete_name ?? strings.someone}</Text>
                      <Text style={styles.meta}>
                        {strings.youAreTheir(relationshipLabel(r.relationship_type).toLowerCase())} · {strings.categoriesShared(r.granted.length)}
                      </Text>
                    </View>
                    <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                  </View>
                  {rosterNotes(r, Date.now()).map((n) => (
                    <Text key={n.text} style={[styles.note, n.tone === 'attention' && styles.attention]}>
                      {n.text}
                    </Text>
                  ))}
                </Card>
              </TouchableOpacity>
            ))}

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.inviteAthlete}</Text>
              <Text style={styles.body}>{strings.inviteAthleteBody}</Text>
              <SegmentedTabs options={RELATIONSHIP_TYPES.map((t) => ({ key: t.key, label: t.label }))} value={type} onChange={(k) => setType(k as RelationshipType)} size="sm" />
              <FieldCard
                label={strings.athleteEmail}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="athlete@example.com"
                cardStyle={styles.inset}
              />
              <GradientButton label={strings.createInvitation} variant="secondary" onPress={() => void invite()} />
              {lastCode ? <Text style={styles.code}>{strings.inviteCodeFor(lastCode.email, lastCode.code)}</Text> : null}
              {invites.length ? (
                <>
                  <Text style={styles.meta}>{strings.openInvitations}</Text>
                  {invites.map((i) => (
                    <Text key={i.id} style={styles.body}>
                      {`${i.invitee_email ?? ''} · ${i.invite_code ?? ''}`}
                    </Text>
                  ))}
                </>
              ) : null}
            </Card>
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
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  card: { gap: spacing.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, marginTop: -spacing.sm, fontFamily: fontFamily.regular },
  meta: { color: colors.textTertiary, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  note: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  attention: { color: colors.amber, fontFamily: fontFamily.medium },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  code: { color: colors.teal, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.semibold },
});
