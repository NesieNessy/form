import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountCard } from '@/components/account/AccountCard';
import { MenuList, type MenuItem } from '@/components/ui/MenuList';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { TabHeader } from '@/components/ui/TabHeader';
import { useAuthStore } from '@/lib/auth';
import { strings } from '@/lib/strings';
import { useWorkspace, type Workspace } from '@/lib/workspace';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const ASK: MenuItem = { icon: Icons.sparkles, color: colors.purple, title: strings.chatTitle, subtitle: strings.chatMenuSubtitle, route: '/chat' };
const FROM_COACH: MenuItem = { icon: Icons.dumbbell, color: colors.purple, title: strings.fromCoachTitle, subtitle: strings.fromCoachMenuSubtitle, route: '/assignments' };
const COACHING: MenuItem = { icon: Icons.users, color: colors.blue, title: strings.coachingTitle, subtitle: strings.coachingMenuSubtitle, route: '/coach' };
const PHYSIO: MenuItem = { icon: Icons.heartPulse, color: colors.teal, title: strings.physioTitle, subtitle: strings.physioMenuSubtitle, route: '/physio' };
const STUDIOS: MenuItem = { icon: Icons.layoutGrid, color: colors.teal, title: strings.studioTitle, subtitle: strings.studioMenuSubtitle, route: '/studio' };
const PRESETS: MenuItem = { icon: Icons.layers, color: colors.green, title: strings.targetedWorkoutsTitle, subtitle: strings.targetedWorkoutsSubtitle, route: '/targeted-workouts' };
/** Account and settings are the same in every workspace. */
const ACCOUNT: MenuItem[] = [
  { icon: Icons.personStanding, color: colors.blue, title: strings.profileTitle, subtitle: strings.profileMenuSubtitle, route: '/profile' },
  { icon: Icons.users, color: colors.teal, title: strings.sharingTitle, subtitle: strings.sharingMenuSubtitle, route: '/sharing' },
  { icon: Icons.info, color: colors.amber, title: strings.notificationsTitle, subtitle: strings.notificationsMenuSubtitle, route: '/notifications' },
  { icon: Icons.layoutGrid, color: colors.blue, title: strings.settingsTitle, subtitle: strings.settingsMenuSubtitle, route: '/settings' },
];

const BY_WORKSPACE: Record<Workspace, MenuItem[]> = {
  personal: [ASK, FROM_COACH, STUDIOS, PRESETS],
  coaching: [COACHING, STUDIOS, PRESETS],
  physio: [PHYSIO],
};

/** Everything that is not training, progress or health. Professionals switch workspace here; it changes the list, not anyone's access. */
export default function MoreScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const workspace = useWorkspace((s) => s.workspace);
  const setWorkspace = useWorkspace((s) => s.setWorkspace);
  const current: Workspace = signedIn ? workspace : 'personal';

  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{strings.more}</Text>
        <Text style={styles.subtitle}>{strings.moreSubtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AccountCard />
        {signedIn ? (
          <View style={styles.switcher}>
            <Text style={styles.label}>{strings.workspaceLabel}</Text>
            <SegmentedTabs
              options={[
                { key: 'personal', label: strings.workspacePersonal },
                { key: 'coaching', label: strings.workspaceCoaching },
                { key: 'physio', label: strings.workspacePhysio },
              ]}
              value={current}
              onChange={(k) => setWorkspace(k as Workspace)}
              size="sm"
            />
            <Text style={styles.hint}>{strings.workspaceHint}</Text>
          </View>
        ) : null}
        <MenuList items={BY_WORKSPACE[current]} />
        <MenuList items={ACCOUNT} />
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
  switcher: { gap: 6 },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  hint: { color: colors.textTertiary, fontSize: 12, fontFamily: fontFamily.regular },
});
