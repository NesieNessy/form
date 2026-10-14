import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '@/components/charts/LineChart';
import { StackedBarChart } from '@/components/charts/StackedBarChart';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { SampleBadge } from '@/components/ui/SampleBadge';
import { GradientButton } from '@/components/ui/GradientButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { metricWithUnit } from '@/lib/health/format';
import { metricSeries } from '@/lib/health/logic';
import { METRICS, type MetricKey } from '@/lib/health/model';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { bodyCompositionMonths, bodyCompositionSeries, bodyDevelopment, timeRanges } from '@/lib/mockData';
import { strings } from '@/lib/strings';
import { useContentWidth } from '@/lib/useContentWidth';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

export default function BodyDevelopmentScreen() {
  const [range, setRange] = useState('1y');
  const width = useContentWidth();
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;
  const { before, after } = bodyDevelopment;
  const observations = useWorkoutsStore((s) => s.observations);
  const real = useMemo(() => {
    const live = Object.values(observations).filter((o) => !o.deletedAt);
    return BODY_METRICS.map((metric) => ({ metric, series: metricSeries(live, metric) })).filter((m) => m.series.length > 0);
  }, [observations]);

  if (real.length) {
    return (
      <View style={styles.screen}>
        <DetailHeader title={strings.bodyDevelopmentTitle} subtitle={strings.bodyDevelopmentSubtitle} />
        <ScrollView contentContainerStyle={[styles.content, { gap: spacing.lg }]} showsVerticalScrollIndicator={false}>
          {real.map(({ metric, series }) => {
            const first = series[0];
            const last = series[series.length - 1];
            const change = last.value - first.value;
            return (
              <Card key={metric}>
                <Text style={styles.cardTitle}>{METRICS[metric].label}</Text>
                <Text style={styles.realValue}>{metricWithUnit(metric, last.value)}</Text>
                {series.length > 1 ? (
                  <>
                    <Text style={styles.realMeta}>{`${change > 0 ? '+' : ''}${metricWithUnit(metric, change)} since ${shortDay(first.date)}`}</Text>
                    <View style={{ height: spacing.md }} />
                    <LineChart points={series.map((p) => ({ label: shortDay(p.date), value: p.value }))} color={colors.pink} width={chartWidth} />
                  </>
                ) : null}
              </Card>
            );
          })}
          <GradientButton label={strings.addMeasurement} variant="secondary" onPress={() => router.push('/health')} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.bodyDevelopmentTitle} subtitle={strings.bodyDevelopmentSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SampleBadge explain style={{ marginBottom: spacing.md }} />
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
            <Icons.arrowRight size={20} color={colors.textTertiary} />
            <BodyColumn label={strings.now} metrics={after} tint={colors.blue} />
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />
        <GradientButton label={strings.shareProgress} icon={<Icons.share size={16} color="#fff" />} />
      </ScrollView>
    </View>
  );
}

const BODY_METRICS: MetricKey[] = ['weight_kg', 'body_fat_pct'];

function shortDay(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        <Icons.personStanding size={40} color={tint} />
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
  realValue: { color: colors.text, fontSize: 24, fontFamily: fontFamily.bold },
  realMeta: { color: colors.textSecondary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.regular },
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
