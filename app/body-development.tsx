import { ArrowRight, PersonStanding, Share2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { bodyCompositionMonths, bodyCompositionSeries, bodyDevelopment, timeRanges } from '@/lib/mockData';
import { strings } from '@/lib/strings';
import { useContentWidth } from '@/lib/useContentWidth';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

export default function BodyDevelopmentScreen() {
  const [range, setRange] = useState('1y');
  const width = useContentWidth();
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;
  const { before, after } = bodyDevelopment;

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.bodyDevelopmentTitle} subtitle={strings.bodyDevelopmentSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs options={timeRanges} value={range} onChange={setRange} scrollable size="sm" />
        <View style={{ height: spacing.lg }} />

        <Card>
          <Text style={styles.cardTitle}>{strings.bodyComposition}</Text>
          <View style={styles.legendRow}>
            {bodyCompositionSeries.map((s) => (
              <View key={s.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: spacing.md }} />
          <StackedBarChart categories={bodyCompositionMonths} series={bodyCompositionSeries} width={chartWidth} />
        </Card>

        <Card style={styles.compareCard}>
          <View style={styles.compareRow}>
            <BodyColumn label={strings.before} metrics={before} tint={colors.textTertiary} />
            <ArrowRight size={20} color={colors.textTertiary} />
            <BodyColumn label={strings.now} metrics={after} tint={colors.blue} />
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />
        <GradientButton label={strings.shareProgress} icon={<Share2 size={16} color="#fff" />} />
      </ScrollView>
    </View>
  );
}

function BodyColumn({
  label,
  metrics,
  tint,
}: {
  label: string;
  metrics: { weightKg: number; bodyFatPct: number; muscleMassKg: number };
  tint: string;
}) {
  return (
    <View style={styles.bodyCol}>
      <View style={[styles.silhouetteWrap, { borderColor: `${tint}55` }]}>
        <PersonStanding size={40} color={tint} />
      </View>
      <Text style={styles.bodyColLabel}>{label}</Text>
      <Text style={styles.bodyColMetric}>{metrics.weightKg} kg</Text>
      <Text style={styles.bodyColMetric}>{metrics.bodyFatPct} %</Text>
      <Text style={styles.bodyColMetric}>{metrics.muscleMassKg} kg</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: spacing.sm },
  legendRow: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textSecondary, fontSize: 11.5 },

  compareCard: { marginTop: spacing.lg },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  bodyCol: { alignItems: 'center', gap: 4 },
  silhouetteWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  bodyColLabel: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: 2 },
  bodyColMetric: { color: colors.text, fontSize: 12.5, fontWeight: '600', fontFamily: fontFamily.semibold },
});
