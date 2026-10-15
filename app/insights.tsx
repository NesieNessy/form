import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { Icon } from '@/components/ui/Icon';
import { strings } from '@/lib/strings';
import type { IconKey, Insight } from '@/lib/types';
import { useTrainingStats } from '@/lib/useTrainingStats';
import type { ComputedInsight } from '@/lib/workout/analytics';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

const LOOK: Record<ComputedInsight['kind'], { icon: IconKey; color: string }> = {
  week: { icon: 'flame', color: colors.orange },
  record: { icon: 'trophy', color: colors.amber },
  strength: { icon: 'trending-up', color: colors.purple },
  endurance: { icon: 'medal', color: colors.teal },
  consistency: { icon: 'check-circle', color: colors.green },
};

export default function InsightsScreen() {
  const { hasSessions, insights: computed } = useTrainingStats();
  // Only insights from the athlete's own sessions; none until there are some.
  const insights: Insight[] = hasSessions ? computed.map((i) => ({ id: i.id, title: i.title, body: i.body, ...LOOK[i.kind] })) : [];

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.insightsTipsTitle} subtitle={strings.insightsTipsSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{strings.yourInsights}</Text>
        {insights.length === 0 ? <Text style={styles.empty}>{strings.noInsightsYet}</Text> : null}
        <View style={{ gap: spacing.md }}>
          {insights.map((insight) => (
            <Card key={insight.id} style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: `${insight.color}22` }]}>
                <Icon name={insight.icon} size={18} color={insight.color} />
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.itemTitle}>{insight.title}</Text>
                <Text style={styles.itemBody}>{insight.body}</Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: spacing.md },
  empty: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  itemTitle: { color: colors.text, fontSize: 14.5, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: 4 },
  itemBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
