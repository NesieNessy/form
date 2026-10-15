import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '@/components/charts/LineChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { metricWithUnit } from '@/lib/health/format';
import { metricSeries } from '@/lib/health/logic';
import type { MetricKey } from '@/lib/health/model';
import { locale, strings } from '@/lib/strings';
import { useContentWidth } from '@/lib/useContentWidth';
import { useTrainingStats } from '@/lib/useTrainingStats';
import { enduranceSeries, enduranceStats, rangeStartMs, type DistanceBucket, type RangeKey } from '@/lib/workout/analytics';
import { formatKg } from '@/lib/workout/format';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, radius, spacing, tabular } from '@/theme/colors';

const MAIN_TABS = [
  { key: 'overview', label: strings.overview },
  { key: 'body', label: strings.bodyData },
  { key: 'strength', label: strings.strength },
  { key: 'endurance', label: strings.endurance },
];
const RANGES: { key: RangeKey; label: string }[] = [
  { key: '4w', label: strings.range4w },
  { key: '3m', label: strings.range3m },
  { key: '1y', label: strings.range1y },
  { key: 'all', label: strings.all },
];
const BODY_METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'weight_kg', label: strings.weight, color: colors.blue },
  { key: 'body_fat_pct', label: strings.bodyFat, color: colors.pink },
];
const DISTANCE_TABS: { key: DistanceBucket; label: string }[] = [
  { key: '400m', label: strings.distance400m },
  { key: '1km', label: strings.distance1km },
  { key: '5km', label: strings.distance5km },
  { key: 'all', label: strings.all },
];
const LIFT_COLORS = [colors.purple, colors.amber, colors.blue, colors.pink];
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

/** Trends from the athlete's own records only: measurements, logged sets and recorded efforts. Nothing is filled in. */
export default function TrendsScreen() {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState<RangeKey>('3m');
  const width = useContentWidth();
  const chartWidth = width - spacing.screenX * 2 - spacing.lg * 2;
  const stats = useTrainingStats(range);
  const observations = useWorkoutsStore((s) => s.observations);
  const from = rangeStartMs(range, stats.now);
  const body = BODY_METRICS.map((m) => ({ ...m, points: metricSeries(Object.values(observations), m.key).filter((p) => new Date(`${p.date}T12:00:00`).getTime() >= from) }));

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.yourTrends} />
      <View style={styles.tabsWrap}>
        <SegmentedTabs options={MAIN_TABS} value={tab} onChange={setTab} scrollable />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs options={RANGES} value={range} onChange={(k) => setRange(k as RangeKey)} scrollable size="sm" />

        {tab === 'overview' ? (
          <>
            {body.map((m) => (
              <OverviewRow key={m.key} label={m.label} color={m.color} values={m.points.map((p) => p.value)} value={m.points.length ? metricWithUnit(m.key, m.points[m.points.length - 1].value) : undefined} delta={delta(m.key, m.points)} chartWidth={Math.min(120, chartWidth * 0.32)} />
            ))}
            <OverviewRow
              label={strings.strength}
              color={colors.purple}
              values={stats.lifts[0]?.points.map((p) => p.value) ?? []}
              value={stats.strengthPct === undefined ? undefined : `${stats.strengthPct >= 0 ? '+' : ''}${stats.strengthPct}%`}
              delta={stats.strengthPct === undefined ? undefined : strings.vsStart}
              chartWidth={Math.min(120, chartWidth * 0.32)}
            />
            <EnduranceOverview stats={stats} range={range} chartWidth={Math.min(120, chartWidth * 0.32)} />
          </>
        ) : null}

        {tab === 'body'
          ? body.map((m) => (
              <Card key={m.key} style={styles.card}>
                <Text style={styles.label}>{m.label}</Text>
                {m.points.length === 0 ? (
                  <Text style={styles.empty}>{strings.noBodyDataYet}</Text>
                ) : (
                  <>
                    <Text style={styles.value}>{metricWithUnit(m.key, m.points[m.points.length - 1].value)}</Text>
                    {delta(m.key, m.points) ? <Text style={styles.sub}>{delta(m.key, m.points)}</Text> : null}
                    {m.points.length >= 2 ? <LineChart points={m.points.map((p) => ({ label: shortDay(p.date), value: p.value }))} color={m.color} width={chartWidth} /> : null}
                  </>
                )}
              </Card>
            ))
          : null}

        {tab === 'strength' ? (
          stats.lifts.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.empty}>{strings.logStrengthToSee}</Text>
            </Card>
          ) : (
            <>
              <View style={styles.grid}>
                {stats.lifts.slice(0, 6).map((lift, i) => (
                  <Card key={lift.key} style={styles.liftCard}>
                    <Text style={styles.label} numberOfLines={1}>
                      {lift.name}
                    </Text>
                    <Text style={styles.value}>{formatKg(lift.current)}</Text>
                    {lift.points.length >= 2 ? <Text style={[styles.sub, { color: LIFT_COLORS[i % LIFT_COLORS.length] }]}>{`${lift.deltaFromStart >= 0 ? '+' : '−'}${formatKg(Math.abs(lift.deltaFromStart))}`}</Text> : null}
                    <Sparkline values={lift.points.map((p) => p.value)} color={LIFT_COLORS[i % LIFT_COLORS.length]} width={(chartWidth - spacing.md) / 2 - spacing.lg} height={44} />
                  </Card>
                ))}
              </View>
              <Card style={styles.card}>
                <Text style={styles.label}>{strings.overallProgress}</Text>
                <Text style={styles.value}>{stats.strengthPct === undefined ? strings.notAvailable : `${stats.strengthPct >= 0 ? '+' : ''}${stats.strengthPct}%`}</Text>
                <Text style={styles.sub}>{stats.strengthPct === undefined ? strings.noDataYet : strings.vsStart}</Text>
              </Card>
            </>
          )
        ) : null}

        {tab === 'endurance' ? <EnduranceTab stats={stats} range={range} chartWidth={chartWidth} /> : null}
      </ScrollView>
    </View>
  );
}

/** Change over the shown range, in the measurement's own unit. */
function delta(metric: MetricKey, points: { value: number }[]): string | undefined {
  if (points.length < 2) return undefined;
  const d = points[points.length - 1].value - points[0].value;
  return `${d >= 0 ? '+' : '−'}${metricWithUnit(metric, Math.abs(d))} ${strings.vsStart}`;
}

function OverviewRow({ label, color, values, value, delta: change, chartWidth }: { label: string; color: string; values: number[]; value?: string; delta?: string; chartWidth: number }) {
  return (
    <Card style={styles.overviewCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value ?? strings.notAvailable}</Text>
        <Text style={styles.sub}>{value === undefined ? strings.noDataYet : (change ?? ' ')}</Text>
      </View>
      {values.length >= 2 ? <Sparkline values={values} color={color} width={chartWidth} height={48} /> : null}
    </Card>
  );
}

type Stats = ReturnType<typeof useTrainingStats>;

function EnduranceOverview({ stats, range, chartWidth }: { stats: Stats; range: RangeKey; chartWidth: number }) {
  const pace = enduranceSeries(stats.efforts, 'all', range, stats.now);
  return <OverviewRow label={strings.endurance} color={colors.teal} values={pace?.points.map((p) => p.value) ?? []} value={pace?.currentLabel} delta={pace?.deltaLabel} chartWidth={chartWidth} />;
}

function EnduranceTab({ stats, range, chartWidth }: { stats: Stats; range: RangeKey; chartWidth: number }) {
  const [distance, setDistance] = useState<DistanceBucket>('5km');
  if (stats.efforts.length === 0) {
    return (
      <Card style={styles.card}>
        <Text style={styles.empty}>{strings.logEnduranceToSee}</Text>
      </Card>
    );
  }
  const series = enduranceSeries(stats.efforts, distance, range, stats.now);
  const totals = enduranceStats(stats.efforts, range, stats.now);
  return (
    <>
      <SegmentedTabs options={DISTANCE_TABS} value={distance} onChange={(k) => setDistance(k as DistanceBucket)} scrollable size="sm" />
      <Card style={styles.card}>
        <Text style={styles.label}>{DISTANCE_TABS.find((t) => t.key === distance)?.label}</Text>
        <Text style={styles.value}>{series ? series.currentLabel : strings.notAvailable}</Text>
        <Text style={styles.sub}>{series ? (series.deltaLabel ?? ' ') : strings.noDataYet}</Text>
        {series && series.points.length >= 2 ? <LineChart points={series.points} color={colors.teal} width={chartWidth} /> : null}
      </Card>
      <Card style={styles.card}>
        <Text style={styles.label}>{strings.moreEnduranceStats}</Text>
        <Row label={strings.avgPace} value={totals?.avgPaceLabel ?? strings.notAvailable} />
        <Row label={strings.totalDistance} value={totals?.totalDistanceLabel ?? strings.notAvailable} />
        <Row label={strings.sessions} value={String(totals?.count ?? 0)} />
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sub}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  tabsWrap: { paddingHorizontal: spacing.screenX, marginBottom: spacing.md },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  overviewCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  liftCard: { width: '47%', flexGrow: 1, gap: 4 },
  label: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.medium },
  value: { color: colors.text, fontSize: 22, fontFamily: fontFamily.bold, ...tabular },
  sub: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.regular },
  empty: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderRadius: radius.sm },
  rowValue: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold, ...tabular },
});
