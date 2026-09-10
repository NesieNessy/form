import { Dumbbell } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TabHeader } from '@/components/ui/TabHeader';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function WorkoutsScreen() {
  return (
    <View style={styles.screen}>
      <TabHeader />
      <ScrollView contentContainerStyle={styles.empty} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Dumbbell color={colors.textSecondary} size={28} />
        </View>
        <Text style={styles.title}>No workouts planned yet</Text>
        <Text style={styles.body}>Your training plans will show up here once you create them.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: {
    flexGrow: 1,
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
    fontWeight: '700', fontFamily: fontFamily.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
