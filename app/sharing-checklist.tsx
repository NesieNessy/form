import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { createGrant, listCategories, type DataCategory } from '@/lib/sharing/api';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

/**
 * Shown right after an athlete accepts a professional's invitation. Every
 * category starts off; nothing is pre-selected, and sensitive ones are marked.
 */
export default function SharingChecklistScreen() {
  const { relationshipId, name } = useLocalSearchParams<{ relationshipId: string; name?: string }>();
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories().then((res) => (res.ok ? setCategories(res.data.filter((c) => c.available)) : setError(res.error)));
  }, []);

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    for (const id of selected) {
      const res = await createGrant(relationshipId, id, null);
      if (!res.ok) {
        setBusy(false);
        return setError(res.error);
      }
    }
    setBusy(false);
    router.back();
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.checklistTitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{strings.checklistBody(name ?? strings.someone)}</Text>
        {categories.map((c) => {
          const on = selected.includes(c.id);
          return (
            <TouchableOpacity key={c.id} onPress={() => toggle(c.id)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={c.label}>
              <Card style={[styles.row, on && styles.rowOn]}>
                <View style={[styles.box, on && styles.boxOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {c.label}
                    {c.sensitivity === 'sensitive' ? <Text style={styles.sensitive}>{`  ${strings.checklistSensitive}`}</Text> : null}
                  </Text>
                  <Text style={styles.meta}>{c.description}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <GradientButton label={strings.checklistShare(selected.length)} onPress={() => void finish()} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowOn: { borderColor: `${colors.teal}88` },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textTertiary },
  boxOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  title: { color: colors.text, fontSize: 14.5, fontFamily: fontFamily.semibold },
  sensitive: { color: colors.amber, fontSize: 11.5, fontFamily: fontFamily.medium },
  meta: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, marginTop: 2, fontFamily: fontFamily.regular },
  error: { color: colors.red, fontSize: 13, fontFamily: fontFamily.regular },
});
