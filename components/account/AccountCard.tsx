import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { signOut, useAuthStore } from '@/lib/auth';
import { strings } from '@/lib/strings';
import { pendingChangeCount, syncNow, useSyncStore } from '@/lib/sync';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

/** Who is signed in, and whether this device's changes have reached the server. */
export function AccountCard() {
  const status = useAuthStore((s) => s.status);
  const email = useAuthStore((s) => s.email);
  const syncStatus = useSyncStore((s) => s.status);
  const pending = useWorkoutsStore((s) => pendingChangeCount(s.dirty));

  if (status === 'local') {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>{strings.localMode}</Text>
        <Text style={styles.body}>{strings.localModeBody}</Text>
      </Card>
    );
  }
  if (status !== 'signedIn') return null;

  const syncLine =
    syncStatus === 'syncing'
      ? strings.syncing
      : syncStatus === 'error'
        ? strings.syncFailed
        : pending > 0
          ? strings.syncPending(pending)
          : strings.syncedJustNow;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{strings.account}</Text>
      <Text style={styles.body}>{strings.signedInAs(email ?? '')}</Text>
      <Text style={[styles.body, syncStatus === 'error' && { color: colors.amber }]}>{syncLine}</Text>
      <View style={styles.row}>
        <GradientButton label={strings.syncNow} variant="secondary" style={styles.btn} onPress={() => void syncNow()} />
        <GradientButton label={strings.signOut} variant="secondary" style={styles.btn} onPress={() => void signOut()} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: fontFamily.regular },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  btn: { flex: 1, paddingVertical: 11 },
});
