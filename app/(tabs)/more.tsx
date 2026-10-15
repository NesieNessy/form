import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountCard } from '@/components/account/AccountCard';
import { MenuList, type MenuItem } from '@/components/ui/MenuList';
import { TabHeader } from '@/components/ui/TabHeader';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** Everything that is not training, progress or health: the assistant, people, studios, account and settings. */
const ITEMS: MenuItem[] = [
  { icon: Icons.sparkles, color: colors.purple, title: strings.chatTitle, subtitle: strings.chatMenuSubtitle, route: '/chat' },
  { icon: Icons.dumbbell, color: colors.purple, title: strings.fromCoachTitle, subtitle: strings.fromCoachMenuSubtitle, route: '/assignments' },
  { icon: Icons.users, color: colors.blue, title: strings.coachingTitle, subtitle: strings.coachingMenuSubtitle, route: '/coach' },
  { icon: Icons.heartPulse, color: colors.teal, title: strings.physioTitle, subtitle: strings.physioMenuSubtitle, route: '/physio' },
  { icon: Icons.layoutGrid, color: colors.teal, title: strings.studioTitle, subtitle: strings.studioMenuSubtitle, route: '/studio' },
  { icon: Icons.layers, color: colors.green, title: strings.targetedWorkoutsTitle, subtitle: strings.targetedWorkoutsSubtitle, route: '/targeted-workouts' },
  { icon: Icons.personStanding, color: colors.blue, title: strings.profileTitle, subtitle: strings.profileMenuSubtitle, route: '/profile' },
  { icon: Icons.users, color: colors.teal, title: strings.sharingTitle, subtitle: strings.sharingMenuSubtitle, route: '/sharing' },
  { icon: Icons.info, color: colors.amber, title: strings.notificationsTitle, subtitle: strings.notificationsMenuSubtitle, route: '/notifications' },
  { icon: Icons.layoutGrid, color: colors.blue, title: strings.settingsTitle, subtitle: strings.settingsMenuSubtitle, route: '/settings' },
];

export default function MoreScreen() {
  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{strings.more}</Text>
        <Text style={styles.subtitle}>{strings.moreSubtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AccountCard />
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
