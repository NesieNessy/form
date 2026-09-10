import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MultiLineChart } from '@/components/charts/MultiLineChart';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { longTerm, timeRanges } from '@/lib/mockData';
import { colors, fontFamily, spacing } from '@/theme/colors';

const RANGE_OPTIONS = timeRanges.filter((r) => r.key !== '4w');

export default function LangfristigeEntwicklungScreen() {
  const [range, setRange] = useState('1y');
  const { width } = useWindowDimensions();
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

  const series = [
    { label: 'Gewicht (kg)', color: colors.blue, values: longTerm.weight },
    { label: 'Körperfett (%)', color: colors.pink, values: longTerm.bodyFat },
    { label: 'Kraft (Index)', color: colors.orange, values: longTerm.strengthIndex },
  ];

  return (
    <View style={styles.screen}>
      <DetailHeader title="Langfristige Entwicklung" subtitle="Dein Weg in einer Grafik." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs options={RANGE_OPTIONS} value={range} onChange={setRange} scrollable size="sm" />
        <View style={{ height: spacing.lg }} />

        <Card>
          <View style={styles.legendRow}>
            {series.map((s) => (
              <View key={s.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: spacing.md }} />
          <MultiLineChart categories={longTerm.months} series={series} width={chartWidth} />
        </Card>

        <Card style={styles.captionCard}>
          <Text style={styles.caption}>{longTerm.caption}</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '600', fontFamily: fontFamily.semibold },
  captionCard: { marginTop: spacing.lg, alignItems: 'center' },
  caption: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily: fontFamily.semibold, textAlign: 'center', lineHeight: 20 },
});
