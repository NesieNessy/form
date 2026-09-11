import { router } from 'expo-router';
import {
  BarChart3,
  ChevronRight,
  LineChart as LineChartIcon,
  Lightbulb,
  Sparkles,
  Target,
  PersonStanding,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { TabHeader } from '@/components/ui/TabHeader';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type MenuItem = {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle: string;
  route: string;
};

const items: MenuItem[] = [
  {
    icon: PersonStanding,
    color: colors.pink,
    title: strings.bodyDevelopmentTitle,
    subtitle: strings.bodyDevelopmentSubtitle,
    route: '/body-development',
  },
  {
    icon: BarChart3,
    color: colors.blue,
    title: strings.performanceOverviewTitle,
    subtitle: strings.performanceOverviewSubtitle,
    route: '/performance-overview',
  },
  {
    icon: Sparkles,
    color: colors.purple,
    title: strings.comparisonTitle,
    subtitle: strings.comparisonSubtitle,
    route: '/comparison',
  },
  {
    icon: Target,
    color: colors.teal,
    title: strings.goalsForecastsTitle,
    subtitle: strings.goalsForecastsSubtitle,
    route: '/goals-forecast',
  },
  {
    icon: Lightbulb,
    color: colors.amber,
    title: strings.insightsTipsTitle,
    subtitle: strings.insightsTipsSubtitle,
    route: '/insights',
  },
  {
    icon: LineChartIcon,
    color: colors.orange,
    title: strings.longTermProgressTitle,
    subtitle: strings.longTermProgressSubtitle,
    route: '/long-term-progress',
  },
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
        {items.map((item) => (
          <TouchableOpacity key={item.route} activeOpacity={0.75} onPress={() => router.push(item.route as never)}>
            <Card style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
                <item.icon size={20} color={item.color} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: spacing.screenX, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', fontFamily: fontFamily.bold },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: fontFamily.bold },
  itemSubtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2 },
});
