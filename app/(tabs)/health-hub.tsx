import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MenuList, type MenuItem } from '@/components/ui/MenuList';
import { TabHeader } from '@/components/ui/TabHeader';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const ITEMS: MenuItem[] = [
  { icon: Icons.heart, color: colors.green, title: strings.recoveryTitle, subtitle: strings.recoveryMenuSubtitle, route: '/recovery' },
  { icon: Icons.heartPulse, color: colors.red, title: strings.healthTitle, subtitle: strings.healthMenuSubtitle, route: '/health' },
  { icon: Icons.flame, color: colors.orange, title: strings.nutritionTitle, subtitle: strings.nutritionMenuSubtitle, route: '/nutrition' },
  { icon: Icons.personStanding, color: colors.pink, title: strings.rehabTitle, subtitle: strings.rehabMenuSubtitle, route: '/rehab' },
  { icon: Icons.video, color: colors.purple, title: strings.movementTitle, subtitle: strings.movementMenuSubtitle, route: '/movement' },
];

/** Health: everything about the body, apart from the training itself. */
export default function HealthHubScreen() {
  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{strings.tabHealth}</Text>
        <Text style={styles.subtitle}>{strings.healthHubSubtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MenuList items={ITEMS} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: spacing.screenX, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontFamily: fontFamily.bold },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4, fontFamily: fontFamily.regular },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
});
