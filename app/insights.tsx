import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { Icon } from '@/components/ui/Icon';
import { insights } from '@/lib/mockData';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

export default function InsightsScreen() {
  return (
    <View style={styles.screen}>
      <DetailHeader title="Insights & Tips" subtitle="Personalized recommendations." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Your Insights</Text>
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
