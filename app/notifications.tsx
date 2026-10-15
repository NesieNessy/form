import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { Stepper } from '@/components/ui/Stepper';
import { useAuthStore } from '@/lib/auth';
import {
  getNotificationPreferences,
  listNotifications,
  markNotificationsRead,
  saveNotificationPreferences,
  type AppNotification,
  type NotificationPreferences,
} from '@/lib/sharing/api';
import { hourLabel } from '@/lib/sharing/quietHours';
import { strings, locale } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

const CATEGORIES: { key: AppNotification['category']; label: string }[] = [
  { key: 'sharing', label: strings.notifySharing },
  { key: 'training', label: strings.notifyTraining },
  { key: 'account', label: strings.notifyAccount },
];

const hhmm = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const hourOf = (value: string | null, fallback: number) => (value ? Number(value.slice(0, 2)) : fallback);

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export default function NotificationsScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const userId = useAuthStore((s) => s.userId);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ quietHoursStart: null, quietHoursEnd: null, timezone: deviceTimezone(), mutedCategories: [] });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    Promise.all([listNotifications(), getNotificationPreferences()]).then(([list, saved]) => {
      if (cancelled) return;
      if (list.ok) {
        setItems(list.data);
        // Opening the inbox is what marks its contents as read.
        void markNotificationsRead(list.data.filter((n) => !n.read_at).map((n) => n.id));
      }
      if (saved.ok && saved.data) setPrefs(saved.data);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const save = useCallback(
    (next: NotificationPreferences) => {
      setPrefs(next);
      if (userId) void saveNotificationPreferences(userId, { ...next, timezone: deviceTimezone() });
    },
    [userId]
  );

  const quietOn = Boolean(prefs.quietHoursStart && prefs.quietHoursEnd);

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.notificationsTitle} subtitle={strings.notificationsSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!signedIn ? (
          <Card>
            <Text style={styles.body}>{strings.notificationsNeedAccount}</Text>
          </Card>
        ) : (
          <>
            {loaded && items.length === 0 ? <Text style={styles.body}>{strings.noNotifications}</Text> : null}
            {items.map((n) => (
              <Card key={n.id} style={[styles.item, !n.read_at && styles.itemUnread]}>
                <Text style={styles.itemTitle}>{n.title}</Text>
                <Text style={styles.body}>{n.body}</Text>
                <Text style={styles.when}>
                  {new Date(n.created_at).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </Text>
              </Card>
            ))}

            <Text style={styles.sectionTitle}>{strings.whatToNotify}</Text>
            <Card style={styles.card}>
              {CATEGORIES.map((c) => {
                const on = !prefs.mutedCategories.includes(c.key);
                return (
                  <View key={c.key} style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{c.label}</Text>
                    <Switch
                      value={on}
                      onValueChange={() =>
                        save({
                          ...prefs,
                          mutedCategories: on ? [...prefs.mutedCategories, c.key] : prefs.mutedCategories.filter((k) => k !== c.key),
                        })
                      }
                      trackColor={{ true: colors.blue, false: colors.border }}
                      thumbColor={colors.text}
                      accessibilityLabel={c.label}
                    />
                  </View>
                );
              })}
            </Card>

            <Text style={styles.sectionTitle}>{strings.quietHours}</Text>
            <Card style={styles.card}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>{strings.quietHours}</Text>
                  <Text style={styles.body}>
                    {quietOn ? strings.quietHoursRange(hourLabel(prefs.quietHoursStart), hourLabel(prefs.quietHoursEnd)) : strings.quietHoursOff}
                  </Text>
                </View>
                <Switch
                  value={quietOn}
                  onValueChange={() => save(quietOn ? { ...prefs, quietHoursStart: null, quietHoursEnd: null } : { ...prefs, quietHoursStart: hhmm(22), quietHoursEnd: hhmm(7) })}
                  trackColor={{ true: colors.blue, false: colors.border }}
                  thumbColor={colors.text}
                  accessibilityLabel={strings.quietHours}
                />
              </View>
              {quietOn ? (
                <>
                  <Text style={styles.label}>{strings.quietFrom}</Text>
                  <Stepper
                    value={hourOf(prefs.quietHoursStart, 22)}
                    onChange={(h) => save({ ...prefs, quietHoursStart: hhmm(((h % 24) + 24) % 24) })}
                    min={-1}
                    max={24}
                    suffix={`· ${hourLabel(prefs.quietHoursStart)}`}
                  />
                  <Text style={styles.label}>{strings.quietUntil}</Text>
                  <Stepper
                    value={hourOf(prefs.quietHoursEnd, 7)}
                    onChange={(h) => save({ ...prefs, quietHoursEnd: hhmm(((h % 24) + 24) % 24) })}
                    min={-1}
                    max={24}
                    suffix={`· ${hourLabel(prefs.quietHoursEnd)}`}
                  />
                </>
              ) : null}
              <Text style={styles.body}>{strings.quietHoursNote}</Text>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontFamily: fontFamily.bold, marginTop: spacing.md },
  card: { gap: spacing.md },
  item: { gap: 4 },
  itemUnread: { borderColor: colors.blue },
  itemTitle: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  when: { color: colors.textTertiary, fontSize: 11.5, fontFamily: fontFamily.regular },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  switchLabel: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
});
