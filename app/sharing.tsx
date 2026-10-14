import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RelationshipCard } from '@/components/sharing/RelationshipCard';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Toast } from '@/components/ui/Toast';
import { FieldCard } from '@/components/workout/FieldCard';
import { signOut, useAuthStore } from '@/lib/auth';
import { removeAllMyClipFiles } from '@/lib/movement/api';
import {
  RELATIONSHIP_TYPES,
  acceptInvite,
  deleteMyAccount,
  endRelationship,
  inviteProfessional,
  listCategories,
  listRelationships,
  myDataAccessLog,
  relationshipLabel,
  type AccessLogEntry,
  type DataCategory,
  type Relationship,
  type RelationshipType,
} from '@/lib/sharing/api';
import { buildExport, deliverExport } from '@/lib/sharing/exportFile';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const DELETE_WORD = 'DELETE';

function describe(entry: AccessLogEntry, categories: DataCategory[]): string {
  const category = categories.find((c) => c.id === entry.data_category)?.label.toLowerCase();
  const who = entry.by_me ? strings.you : (entry.actor_name ?? strings.someone);
  switch (entry.action) {
    case 'data.read':
      return strings.logRead(who, category ?? 'data');
    case 'grant.created':
      return strings.logGrantCreated(category ?? 'data');
    case 'grant.revoked':
      return strings.logGrantRevoked(who, category ?? 'data');
    case 'relationship.invited':
      return strings.logInvited;
    case 'relationship.accepted':
      return strings.logAccepted(who);
    case 'relationship.ended':
      return strings.logEnded(who);
    case 'data.exported':
      return strings.logExported;
    default:
      return entry.action;
  }
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SharingScreen() {
  const status = useAuthStore((s) => s.status);
  const signedIn = status === 'signedIn';
  const wipe = useWorkoutsStore((s) => s.wipe);

  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [log, setLog] = useState<AccessLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [type, setType] = useState<RelationshipType>('training_coach');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    if (!signedIn) return;
    const [rel, cat, access] = await Promise.all([listRelationships(), listCategories(), myDataAccessLog(30)]);
    if (rel.ok) setRelationships(rel.data);
    if (cat.ok) setCategories(cat.data.filter((c) => c.available));
    if (access.ok) setLog(access.data);
    const failed = [rel, cat, access].find((r) => !r.ok);
    if (failed && !failed.ok) setToast(failed.error);
    setLoaded(true);
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = relationships.filter((r) => r.role === 'athlete' && r.status !== 'ended');
  const sharedWithMe = relationships.filter((r) => r.role === 'professional' && r.status === 'active');

  const invite = async () => {
    if (busy) return;
    setBusy(true);
    const res = await inviteProfessional(email, type);
    if (res.ok) {
      setEmail('');
      setToast(strings.invitationCreated);
    } else setToast(res.error);
    await load();
    setBusy(false);
  };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    const res = await acceptInvite(code);
    if (!res.ok) {
      setToast(res.error);
      setBusy(false);
      return;
    }
    setCode('');
    // A professional invited this athlete: they choose what to share, starting from nothing.
    const rel = await listRelationships();
    const mineNow = rel.ok ? rel.data.find((r) => r.id === res.data && r.role === 'athlete') : undefined;
    if (mineNow) router.push({ pathname: '/sharing-checklist', params: { relationshipId: mineNow.id, name: mineNow.counterpart_name ?? '' } });
    else setToast(strings.invitationAccepted);
    await load();
    setBusy(false);
  };

  const exportData = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { json, serverIncluded } = await buildExport(signedIn);
      await deliverExport(json);
      setToast(signedIn && !serverIncluded ? strings.exportDeviceOnly : strings.exportReady);
    } catch {
      setToast(strings.exportFailed);
    }
    await load();
    setBusy(false);
  };

  const deleteEverything = async () => {
    if (busy || deleteText.trim().toUpperCase() !== DELETE_WORD) return;
    setBusy(true);
    if (signedIn) {
      // Stored clip files are not removed by the database, so they go first.
      const userId = useAuthStore.getState().userId;
      if (userId) await removeAllMyClipFiles(userId).catch(() => undefined);
      const res = await deleteMyAccount();
      if (!res.ok) {
        setToast(res.error);
        setBusy(false);
        return;
      }
    }
    wipe();
    if (signedIn) await signOut({ skipSync: true });
    else router.back();
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.sharingTitle} subtitle={strings.sharingSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {signedIn ? (
          <>
            <Text style={styles.sectionTitle}>{strings.peopleYouShareWith}</Text>
            {loaded && mine.length === 0 ? <Text style={styles.empty}>{strings.sharingWithNoOne}</Text> : null}
            {mine.map((r) => (
              <RelationshipCard key={r.id} relationship={r} categories={categories} onChanged={load} onError={setToast} />
            ))}

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.inviteProfessional}</Text>
              <Text style={styles.body}>{strings.inviteProfessionalBody}</Text>
              <SegmentedTabs
                options={RELATIONSHIP_TYPES.map((t) => ({ key: t.key, label: t.label }))}
                value={type}
                onChange={(k) => setType(k as RelationshipType)}
                size="sm"
              />
              <FieldCard
                label={strings.theirEmail}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="coach@example.com"
                cardStyle={styles.inset}
              />
              <GradientButton label={strings.createInvitation} variant="secondary" onPress={() => void invite()} />
            </Card>

            <Text style={styles.sectionTitle}>{strings.sharedWithYou}</Text>
            {loaded && sharedWithMe.length === 0 ? <Text style={styles.empty}>{strings.nobodySharesWithYou}</Text> : null}
            {sharedWithMe.map((r) => (
              <Card key={r.id} style={styles.card}>
                <TouchableOpacity
                  style={styles.linkRow}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: '/shared-athlete', params: { athleteId: r.athlete_id } })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.counterpart_name}</Text>
                    <Text style={styles.body}>
                      {strings.youAreTheir(relationshipLabel(r.relationship_type).toLowerCase())} · {strings.categoriesShared(r.grants.length)}
                    </Text>
                  </View>
                  <Icons.chevronRight size={18} color={colors.textTertiary} strokeWidth={iconStrokeWidth} />
                </TouchableOpacity>
                <GradientButton
                  label={strings.endConnection}
                  variant="tertiary"
                  onPress={async () => {
                    const res = await endRelationship(r.id);
                    if (!res.ok) setToast(res.error);
                    await load();
                  }}
                />
              </Card>
            ))}

            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{strings.haveInviteCode}</Text>
              <Text style={styles.body}>{strings.haveInviteCodeBody}</Text>
              <FieldCard
                label={strings.inviteCode}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase().slice(0, 10))}
                autoCapitalize="characters"
                autoCorrect={false}
                cardStyle={styles.inset}
              />
              <GradientButton label={strings.acceptInvitation} variant="secondary" onPress={() => void accept()} />
            </Card>

            <Text style={styles.sectionTitle}>{strings.accessLogTitle}</Text>
            <Text style={styles.body}>{strings.accessLogBody}</Text>
            <Card style={styles.logCard}>
              {loaded && log.length === 0 ? <Text style={styles.empty}>{strings.accessLogEmpty}</Text> : null}
              {log.map((entry) => (
                <View key={entry.id} style={styles.logRow}>
                  <View style={[styles.logDot, entry.action === 'data.read' && { backgroundColor: colors.blue }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logText}>{describe(entry, categories)}</Text>
                    <Text style={styles.logWhen}>{when(entry.occurred_at)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.sharingNeedsAccount}</Text>
            <Text style={styles.body}>{strings.sharingNeedsAccountBody}</Text>
          </Card>
        )}

        <Text style={styles.sectionTitle}>{strings.yourData}</Text>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{strings.exportMyData}</Text>
          <Text style={styles.body}>{strings.exportMyDataBody}</Text>
          <GradientButton label={strings.exportMyData} variant="secondary" onPress={() => void exportData()} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{signedIn ? strings.deleteAccount : strings.deleteDeviceData}</Text>
          <Text style={styles.body}>{signedIn ? strings.deleteAccountBody : strings.deleteDeviceDataBody}</Text>
          {confirmingDelete ? (
            <>
              <Text style={styles.body}>{strings.typeDeleteToConfirm(DELETE_WORD)}</Text>
              <TextInput
                style={styles.deleteInput}
                value={deleteText}
                onChangeText={setDeleteText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={DELETE_WORD}
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel={strings.typeDeleteToConfirm(DELETE_WORD)}
              />
              <View style={styles.row}>
                <GradientButton
                  label={strings.cancel}
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setConfirmingDelete(false);
                    setDeleteText('');
                  }}
                />
                <GradientButton
                  label={strings.deleteForever}
                  colorsOverride={deleteText.trim().toUpperCase() === DELETE_WORD ? [colors.red, colors.red] : [colors.border, colors.border]}
                  style={{ flex: 1 }}
                  onPress={() => void deleteEverything()}
                />
              </View>
            </>
          ) : (
            <GradientButton label={signedIn ? strings.deleteAccount : strings.deleteDeviceData} variant="tertiary" onPress={() => setConfirmingDelete(true)} />
          )}
        </Card>
      </ScrollView>
      <Toast message={toast ?? ''} visible={Boolean(toast)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl * 2, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.regular },
  inset: { marginBottom: 0, backgroundColor: colors.cardAlt, borderWidth: 0 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logCard: { gap: spacing.md },
  logRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colors.textTertiary },
  logText: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.regular },
  logWhen: { color: colors.textTertiary, fontSize: 11.5, marginTop: 1, fontFamily: fontFamily.regular },
  row: { flexDirection: 'row', gap: spacing.md },
  deleteInput: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fontFamily.bold,
    letterSpacing: 2,
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    height: 44,
  },
});
