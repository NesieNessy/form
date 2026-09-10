import { Dumbbell } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TabHeader } from '@/components/ui/TabHeader';
import { colors, spacing } from '@/theme/colors';

export default function WorkoutsScreen() {
  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <Dumbbell color={colors.textSecondary} size={28} />
        </View>
        <Text style={styles.title}>Noch keine Workouts geplant</Text>
        <Text style={styles.body}>Deine Trainingspläne erscheinen hier, sobald du sie anlegst.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
