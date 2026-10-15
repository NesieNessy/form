import { progressText } from '@/lib/goals/describe';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { MenuList, type MenuItem } from '@/components/ui/MenuList';
import { TabHeader } from '@/components/ui/TabHeader';
import { strings } from '@/lib/strings';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const MAIN: MenuItem[] = [
  { icon: Icons.target, color: colors.teal, title: strings.goalsTitle, subtitle: strings.goalsMenuSubtitle, route: '/goals-forecast' },
  { icon: Icons.lineChart, color: colors.blue, title: strings.yourTrends, subtitle: strings.trendsMenuSubtitle, route: '/trends' },
];
const MORE: MenuItem[] = [
  { icon: Icons.barChart, color: colors.blue, title: strings.performanceOverviewTitle, subtitle: strings.performanceOverviewSubtitle, route: '/performance-overview' },
  { icon: Icons.personStanding, color: colors.pink, title: strings.bodyDevelopmentTitle, subtitle: strings.bodyDevelopmentSubtitle, route: '/body-development' },
  { icon: Icons.lightbulb, color: colors.amber, title: strings.insightsTipsTitle, subtitle: strings.insightsTipsSubtitle, route: '/insights' },
];

/** Progress: goals first, then trends and the other views of the athlete's own records. */
export default function ProgressScreen() {
  const goals = useWorkoutsStore((s) => s.goals);
  const refreshGoals = useWorkoutsStore((s) => s.refreshGoals);
  useFocusEffect(
    useCallback(() => {
      refreshGoals();
    }, [refreshGoals])
  );
  const active = Object.values(goals)
    .filter((g) => !g.deletedAt && g.status === 'active')
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{strings.tabProgress}</Text>
        <Text style={styles.subtitle}>{strings.progressSubtitle}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {active.length ? (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{strings.activeGoals(active.length)}</Text>
            {active.slice(0, 3).map((g) => {
              const pct = g.progress?.fraction !== undefined ? Math.round(Math.min(1, Math.max(0, g.progress.fraction)) * 100) : undefined;
              return (
                <TouchableOpacity key={g.id} onPress={() => router.push({ pathname: '/goal', params: { id: g.id } })} accessibilityRole="link" accessibilityLabel={g.title} style={styles.goal}>
                  <Text style={styles.goalTitle} numberOfLines={1}>
                    {g.title}
                  </Text>
                  {pct !== undefined ? (
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct}%` }]} />
                    </View>
                  ) : null}
                  {g.progress ? <Text style={styles.meta}>{progressText(g)}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </Card>
        ) : null}
        <MenuList items={MAIN} />
        <MenuList items={MORE} />
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
  card: { gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  goal: { gap: 4 },
  goalTitle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
  meta: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.regular },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.cardAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.teal },
  section: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.semibold, marginTop: spacing.sm },
});
