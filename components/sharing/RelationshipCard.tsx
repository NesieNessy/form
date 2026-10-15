import React, { useState } from 'react';
import { Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  createGrant,
  endRelationship,
  purposeLabel,
  relationshipLabel,
  revokeGrant,
  type DataCategory,
  type Relationship,
} from '@/lib/sharing/api';
import { strings, locale } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

const DURATIONS = [
  { key: 'none', label: strings.noEndDate, days: null },
  { key: '3m', label: strings.threeMonths, days: 91 },
  { key: '1y', label: strings.oneYear, days: 365 },
] as const;

type Props = {
  relationship: Relationship;
  categories: DataCategory[];
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One person the athlete shares with: what they can read, for how long, and the way to stop. */
export function RelationshipCard({ relationship: r, categories, onChanged, onError }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]['key']>('none');
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    if (busy) return;
    setBusy(key);
    const res = await action();
    if (!res.ok && res.error) onError(res.error);
    await onChanged();
    setBusy(null);
  };

  const toggle = (category: DataCategory) => {
    const existing = r.grants.find((g) => g.data_category === category.id);
    if (existing) return run(category.id, () => revokeGrant(existing.id));
    const days = DURATIONS.find((d) => d.key === duration)?.days ?? null;
    const expires = days ? new Date(Date.now() + days * 86_400_000) : null;
    return run(category.id, () => createGrant(r.id, category.id, expires));
  };

  const name = r.counterpart_name ?? r.invitee_email ?? '';

  return (
    <Card style={styles.card}>
      <View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {relationshipLabel(r.relationship_type)} · {r.status === 'invited' ? strings.invitationPending : strings.connected}
        </Text>
      </View>

      {r.status === 'invited' && r.invite_code ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>{strings.inviteCode}</Text>
          <Text style={styles.code} selectable>
            {r.invite_code}
          </Text>
          <Text style={styles.codeHint}>
            {strings.inviteCodeHint(r.invitee_email ?? '', r.invite_expires_at ? dateLabel(r.invite_expires_at) : '')}
          </Text>
          <GradientButton
            label={strings.shareCode}
            variant="secondary"
            style={styles.smallBtn}
            onPress={() => {
              Share.share({ message: strings.inviteShareMessage(r.invite_code ?? '') }).catch(() => {});
            }}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{strings.whatTheyCanSee}</Text>
        <Text style={styles.consent}>{strings.consentV1(purposeLabel(r.relationship_type))}</Text>
        <Text style={styles.durationLabel}>{strings.newSharingLasts}</Text>
        <SegmentedTabs options={DURATIONS.map((d) => ({ key: d.key, label: d.label }))} value={duration} onChange={(k) => setDuration(k as typeof duration)} size="sm" />

        {categories.map((category) => {
          const granted = r.grants.find((g) => g.data_category === category.id);
          return (
            <View key={category.id} style={styles.categoryRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.categoryLabel}>{category.label}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
                {granted ? (
                  <Text style={styles.grantMeta}>
                    {granted.expires_at ? strings.sharedUntil(dateLabel(granted.expires_at)) : strings.sharedNoEnd}
                  </Text>
                ) : null}
              </View>
              <Switch
                value={Boolean(granted)}
                disabled={busy !== null}
                onValueChange={() => void toggle(category)}
                trackColor={{ true: colors.blue, false: colors.border }}
                thumbColor={colors.text}
                accessibilityLabel={`${strings.share} ${category.label}`}
              />
            </View>
          );
        })}
      </View>

      {confirmingEnd ? (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>{strings.confirmEndConnection}</Text>
          <View style={styles.row}>
            <GradientButton label={strings.cancel} variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmingEnd(false)} />
            <GradientButton
              label={r.status === 'invited' ? strings.cancelInvitation : strings.endConnection}
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => void run('end', () => endRelationship(r.id))}
            />
          </View>
        </View>
      ) : (
        <GradientButton
          label={r.status === 'invited' ? strings.cancelInvitation : strings.endConnection}
          variant="tertiary"
          onPress={() => setConfirmingEnd(true)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  name: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold },
  meta: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
  codeBox: { gap: 4, backgroundColor: colors.cardAlt, borderRadius: 12, padding: spacing.md },
  codeLabel: { color: colors.textSecondary, fontSize: 11.5, fontFamily: fontFamily.medium },
  code: { color: colors.text, fontSize: 24, fontFamily: fontFamily.bold, letterSpacing: 3 },
  codeHint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  smallBtn: { marginTop: spacing.sm, paddingVertical: 10 },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.bold },
  consent: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily.regular },
  durationLabel: { color: colors.textSecondary, fontSize: 12, marginTop: spacing.xs, fontFamily: fontFamily.medium },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryLabel: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  categoryDescription: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, marginTop: 1, fontFamily: fontFamily.regular },
  grantMeta: { color: colors.teal, fontSize: 11.5, marginTop: 3, fontFamily: fontFamily.semibold },
  confirm: { gap: spacing.md },
  confirmText: { color: colors.text, fontSize: 13.5, lineHeight: 19, fontFamily: fontFamily.semibold },
  row: { flexDirection: 'row', gap: spacing.md },
});
