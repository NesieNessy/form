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
import { colors, radius, spacing } from '@/theme/colors';

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
    title: 'Körperliche Entwicklung',
    subtitle: 'Sieh, wie sich dein Körper verändert.',
    route: '/koerperliche-entwicklung',
  },
  {
    icon: BarChart3,
    color: colors.blue,
    title: 'Performance Übersicht',
    subtitle: 'Alle wichtigen Kennzahlen.',
    route: '/performance-uebersicht',
  },
  {
    icon: Sparkles,
    color: colors.purple,
    title: 'Vergleich',
    subtitle: 'Vergleiche dich mit dir selbst.',
    route: '/vergleich',
  },
  {
    icon: Target,
    color: colors.teal,
    title: 'Ziele & Prognosen',
    subtitle: 'Sieh, wohin die Reise geht.',
    route: '/ziele-prognosen',
  },
  {
    icon: Lightbulb,
    color: colors.amber,
    title: 'Insights & Tipps',
    subtitle: 'Personalisierte Empfehlungen.',
    route: '/insights',
  },
  {
    icon: LineChartIcon,
    color: colors.orange,
    title: 'Langfristige Entwicklung',
    subtitle: 'Dein Weg in einer Grafik.',
    route: '/langfristige-entwicklung',
  },
];

export default function MehrScreen() {
  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.title}>Mehr</Text>
        <Text style={styles.subtitle}>Tiefere Einblicke in deinen Fortschritt.</Text>
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
  titleRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  itemSubtitle: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2 },
});
