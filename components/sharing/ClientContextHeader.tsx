import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { listCategories, purposeLabel, relationshipLabel, requestDataAccess, type DataCategory, type RelationshipType } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  athleteName: string;
  relationshipId: string;
  relationshipType: RelationshipType;
  granted: string[];
  onError: (message: string) => void;
};

/**
 * Who is viewing whose data, in which role and why, what is shared, and
 * "Request access" for the rest. A request only notifies the athlete.
 */
export function ClientContextHeader({ athleteName, relationshipId, relationshipType, granted, onError }: Props) {
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [asked, setAsked] = useState<string[]>([]);

  useEffect(() => {
    void listCategories().then((res) => res.ok && setCategories(res.data.filter((c) => c.available)));
  }, []);

  const shared = categories.filter((c) => granted.includes(c.id));
  const missing = categories.filter((c) => !granted.includes(c.id));

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Icons.users size={16} color={colors.textSecondary} strokeWidth={iconStrokeWidth} />
        <Text style={[styles.body, { flex: 1 }]}>{strings.viewingAs(athleteName, relationshipLabel(relationshipType).toLowerCase(), purposeLabel(relationshipType))}</Text>
      </View>
      <Text style={styles.label}>{strings.sharedWithYouNow}</Text>
      <Text style={styles.body}>{shared.length ? shared.map((c) => c.label).join(', ') : strings.nothingSharedShort}</Text>
      {missing.length ? (
        <>
          <Text style={styles.label}>{strings.notSharedWithYou}</Text>
          <View style={styles.wrap}>
            {missing.map((c) => {
              const done = asked.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, done && styles.chipDone]}
                  disabled={done}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: done }}
                  accessibilityLabel={`${done ? strings.accessRequested : strings.requestAccess}: ${c.label}`}
                  onPress={async () => {
                    const res = await requestDataAccess(relationshipId, c.id);
                    if (!res.ok) return onError(res.error);
                    setAsked((a) => [...a, c.id]);
                  }}
                >
                  {done ? <Icons.checkCircle size={13} color={colors.textTertiary} strokeWidth={iconStrokeWidth} /> : <Icons.plus size={13} color={colors.action} strokeWidth={iconStrokeWidth} />}
                  <Text style={[styles.chipText, done && { color: colors.textTertiary }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.hint}>{strings.requestAccessHint}</Text>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  body: { color: colors.text, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  chipDone: { borderColor: colors.border },
  chipText: { color: colors.action, fontSize: 12.5, fontFamily: fontFamily.semibold },
});
