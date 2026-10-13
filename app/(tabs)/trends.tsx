import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from '@/components/charts/LineChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { Card } from '@/components/ui/Card';
import { SampleBadge } from '@/components/ui/SampleBadge';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { TabHeader } from '@/components/ui/TabHeader';
import {
  bodyMetricHistory,
  enduranceSessions,
  enduranceStats as sampleEnduranceStats,
  strengthLifts as sampleStrengthLifts,
  strengthOverallProgressPct,
  timeRanges,
  trendsOverview,
} from '@/lib/mockData';
import { useContentWidth } from '@/lib/useContentWidth';
import { strings } from '@/lib/strings';
import { useTrainingStats } from '@/lib/useTrainingStats';
import {
  enduranceSeries,
  enduranceStats,
  type DistanceBucket,
  type EnduranceEffort,
  type LiftSeries,
  type RangeKey,
} from '@/lib/workout/analytics';
import { formatKg } from '@/lib/workout/format';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const MAIN_TABS = [
  { key: 'overview', label: strings.overview },
  { key: 'body-data', label: strings.bodyData },
  { key: 'strength', label: strings.strength },
  { key: 'endurance', label: strings.endurance },
];

const BODY_METRIC_TABS = [
  { key: 'weight', label: strings.weight },
  { key: 'bodyfat', label: strings.bodyFat },
  { key: 'musclemass', label: strings.muscleMass },
  { key: 'bmi', label: strings.bmi },
];

const DISTANCE_TABS = [
  { key: '400m', label: strings.distance400m },
  { key: '1km', label: strings.distance1km },
  { key: '5km', label: strings.distance5km },
  { key: 'all', label: strings.all },
];

const LIFT_COLORS = [colors.purple, colors.amber, colors.blue, colors.pink];

type TrainingProps = { lifts: LiftSeries[]; strengthPct: number | undefined; efforts: EnduranceEffort[]; range: RangeKey; now: number };

export default function TrendsScreen() {
  const [mainTab, setMainTab] = useState('overview');
  const [range, setRange] = useState<RangeKey>('3m');
  const width = useContentWidth();
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;
  const stats = useTrainingStats(range);
  const training: TrainingProps = { lifts: stats.lifts, strengthPct: stats.strengthPct, efforts: stats.efforts, range, now: stats.now };

  return (
    <View style={styles.screen}>
      <TabHeader />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{strings.yourTrends}</Text>
      </View>

      <View style={styles.tabsWrap}>
        <SegmentedTabs options={MAIN_TABS} value={mainTab} onChange={setMainTab} scrollable />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs
          options={timeRanges.map((r) => ({ key: r.key, label: r.label }))}
          value={range}
          onChange={(key) => setRange(key as RangeKey)}
          scrollable
          size="sm"
        />
        <View style={{ height: spacing.lg }} />

        {mainTab === 'overview' && <OverviewTab chartWidth={Math.min(120, chartWidth * 0.32)} {...training} />}
        {mainTab === 'body-data' && <BodyDataTab chartWidth={chartWidth} />}
        {mainTab === 'strength' && <StrengthTab chartWidth={chartWidth} {...training} />}
        {mainTab === 'endurance' && <EnduranceTab chartWidth={chartWidth} {...training} />}
      </ScrollView>
    </View>
  );
}

function OverviewTab({ chartWidth, lifts, strengthPct, efforts, range, now }: { chartWidth: number } & TrainingProps) {
  const topLift = lifts[0];
  const pace = enduranceSeries(efforts, 'all', range, now);

  // Body rows are sample values until body measurements can be recorded;
  // strength and endurance switch to the athlete's own numbers as soon as there are any.
  const rows = trendsOverview.map((item) => {
    if (item.key === 'strength' && topLift) {
      return {
        ...item,
        value: strengthPct === undefined ? strings.notAvailable : `${strengthPct >= 0 ? '+' : ''}${strengthPct}%`,
        delta: strengthPct === undefined ? strings.noDataYet : strings.vsStart,
        points: topLift.points.map((p) => p.value),
        sample: false,
      };
    }
    if (item.key === 'endurance' && pace) {
      return {
        ...item,
        value: pace.currentLabel,
        delta: pace.deltaLabel ?? ' ',
        points: pace.points.map((p) => p.value),
        sample: false,
      };
    }
    return { ...item, sample: true };
  });

  return (
    <View style={{ gap: spacing.md }}>
      {rows.map((item) => (
        <Card key={item.key} style={styles.overviewCard}>
          <View style={styles.overviewText}>
            {item.sample ? <SampleBadge style={{ marginBottom: 4 }} /> : null}
            <Text style={styles.overviewLabel}>{item.label}</Text>
            <Text style={styles.overviewValue}>{item.value}</Text>
            <Text style={[styles.overviewDelta, { color: item.color }]}>{item.delta}</Text>
          </View>
          <Sparkline values={item.points} color={item.color} width={chartWidth} height={48} />
        </Card>
      ))}
    </View>
  );
}
function BodyDataTab({ chartWidth }: { chartWidth: number }) {
  const [metric, setMetric] = useState('weight');

  const config = useMemo(() => {
    switch (metric) {
      case 'bodyfat':
        return {
          color: colors.pink,
          unit: '%',
          points: bodyMetricHistory.map((p) => ({ label: p.date, value: p.bodyFatPct })),
        };
      case 'musclemass':
        return {
          color: colors.purple,
          unit: 'kg',
          points: bodyMetricHistory.map((p) => ({ label: p.date, value: p.muscleMassKg })),
        };
      case 'bmi':
        return {
          color: colors.amber,
          unit: '',
          points: bodyMetricHistory.map((p) => ({ label: p.date, value: p.bmi })),
        };
      default:
        return {
          color: colors.blue,
          unit: 'kg',
          points: bodyMetricHistory.map((p) => ({ label: p.date, value: p.weightKg })),
        };
    }
  }, [metric]);

  const start = config.points[0].value;
  const current = config.points[config.points.length - 1].value;
  const deltaPct = Math.round(((current - start) / start) * 100);

  return (
    <View>
      <SampleBadge explain style={{ marginBottom: spacing.md }} />
      <SegmentedTabs options={BODY_METRIC_TABS} value={metric} onChange={setMetric} scrollable size="sm" />
      <View style={{ height: spacing.lg }} />
      <Card>
        <View style={styles.chartHeaderRow}>
          <View>
            <Text style={styles.chartLabel}>{BODY_METRIC_TABS.find((t) => t.key === metric)?.label}</Text>
            <Text style={styles.chartValue}>
              {current.toLocaleString('en-US', { maximumFractionDigits: 1 })} {config.unit}
            </Text>
          </View>
          <View style={[styles.deltaPill, { backgroundColor: `${config.color}22` }]}>
            <Text style={[styles.deltaPillText, { color: config.color }]}>
              {deltaPct > 0 ? '+' : ''}
              {deltaPct}%
            </Text>
          </View>
        </View>
        <Text style={styles.sinceLabel}>
          {(current - start).toLocaleString('en-US', { maximumFractionDigits: 1, signDisplay: 'always' })} {config.unit} since Jul 1, 2026
        </Text>
        <View style={{ height: spacing.md }} />
        <LineChart points={config.points} color={config.color} width={chartWidth} />
      </Card>

      <View style={styles.boxRow}>
        <MiniBox label={strings.start} value={`${start} ${config.unit}`} />
        <MiniBox label={strings.current} value={`${current} ${config.unit}`} highlight />
        <MiniBox label={strings.target} value={metric === 'weight' ? '70.0 kg' : '—'} />
      </View>

      <TouchableOpacity style={styles.infoRow} activeOpacity={0.7}>
        <Icons.info size={16} color={colors.textSecondary} />
        <Text style={styles.infoText}>{strings.howIsThisMeasured}</Text>
      </TouchableOpacity>

      <Card style={styles.tipCard}>
        <Text style={styles.tipTitle}>{strings.tip}</Text>
        <Text style={styles.tipBody}>
          {strings.tipBody(BODY_METRIC_TABS.find((t) => t.key === metric)?.label ?? '')}
        </Text>
      </Card>
    </View>
  );
}

function StrengthTab({ chartWidth, lifts, strengthPct }: { chartWidth: number } & TrainingProps) {
  const sparkWidth = (chartWidth - spacing.md) / 2 - spacing.lg;
  const real = lifts.length > 0;
  const cards = real
    ? lifts.slice(0, 6).map((lift, i) => ({
        name: lift.name,
        current: lift.current,
        delta: lift.deltaFromStart,
        values: lift.points.map((p) => p.value),
        color: LIFT_COLORS[i % LIFT_COLORS.length],
      }))
    : sampleStrengthLifts.map((lift) => ({
        name: lift.exercise,
        current: lift.current,
        delta: lift.deltaFromStart,
        values: lift.points.map((p) => p.value),
        color: lift.color,
      }));
  const overall = real ? strengthPct : strengthOverallProgressPct;

  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.yourStrengthProgress}</Text>
      {real ? null : (
        <View style={styles.sampleNote}>
          <SampleBadge />
          <Text style={styles.sampleHint}>{strings.logStrengthToSee}</Text>
        </View>
      )}
      <View style={styles.liftGrid}>
        {cards.map((lift) => (
          <Card key={lift.name} style={styles.liftCard}>
            <Text style={styles.liftName}>{lift.name}</Text>
            <Text style={styles.liftValue}>
              {formatKg(lift.current)}{' '}
              {lift.values.length >= 2 ? (
                <Text style={[styles.liftDelta, { color: lift.color }]}>
                  {lift.delta >= 0 ? '+' : '-'}
                  {formatKg(Math.abs(lift.delta))}
                </Text>
              ) : null}
            </Text>
            <Sparkline values={lift.values} color={lift.color} width={sparkWidth} height={44} />
          </Card>
        ))}
      </View>

      <Card style={styles.progressCard}>
        <Text style={styles.progressLabel}>{strings.overallProgress}</Text>
        <Text style={styles.progressValue}>
          {overall === undefined ? strings.notAvailable : `${overall >= 0 ? '+' : ''}${overall}%`}
        </Text>
        <Text style={styles.progressSub}>{overall === undefined ? strings.noDataYet : strings.vsStart}</Text>
      </Card>
    </View>
  );
}

function EnduranceTab({ chartWidth, efforts, range, now }: { chartWidth: number } & TrainingProps) {
  const [distance, setDistance] = useState<DistanceBucket>('5km');
  const real = efforts.length > 0;
  const series = real ? enduranceSeries(efforts, distance, range, now) : undefined;
  const totals = real ? enduranceStats(efforts, range, now) : undefined;
  const sample = enduranceSessions[0];
  const distanceLabel = DISTANCE_TABS.find((t) => t.key === distance)?.label ?? '';

  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.endurancePerformance}</Text>
      {real ? null : (
        <View style={styles.sampleNote}>
          <SampleBadge />
          <Text style={styles.sampleHint}>{strings.logEnduranceToSee}</Text>
        </View>
      )}
      <SegmentedTabs options={DISTANCE_TABS} value={distance} onChange={(key) => setDistance(key as DistanceBucket)} scrollable size="sm" />
      <View style={{ height: spacing.lg }} />

      {real ? (
        <Card>
          <View style={styles.chartHeaderRow}>
            <View>
              <Text style={styles.chartLabel}>{distanceLabel}</Text>
              <Text style={styles.chartValue}>{series ? series.currentLabel : strings.notAvailable}</Text>
            </View>
            {series?.deltaPct !== undefined ? (
              <View style={[styles.deltaPill, { backgroundColor: `${colors.teal}22` }]}>
                <Text style={[styles.deltaPillText, { color: colors.teal }]}>
                  {series.deltaPct > 0 ? '+' : ''}
                  {series.deltaPct}%
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sinceLabel}>{series ? (series.deltaLabel ?? ' ') : strings.noDataYet}</Text>
          {series && series.points.length >= 2 ? (
            <>
              <View style={{ height: spacing.md }} />
              <LineChart points={series.points} color={colors.teal} width={chartWidth} />
            </>
          ) : null}
        </Card>
      ) : (
        <Card>
          <View style={styles.chartHeaderRow}>
            <View>
              <Text style={styles.chartLabel}>{strings.distance5km}</Text>
              <Text style={styles.chartValue}>{sample.currentLabel}</Text>
            </View>
            <View style={[styles.deltaPill, { backgroundColor: `${colors.teal}22` }]}>
              <Text style={[styles.deltaPillText, { color: colors.teal }]}>{sample.deltaPct}%</Text>
            </View>
          </View>
          <Text style={styles.sinceLabel}>{sample.deltaLabel}</Text>
          <View style={{ height: spacing.md }} />
          <LineChart points={sample.points} color={colors.teal} width={chartWidth} />
        </Card>
      )}

      <View style={{ height: spacing.md }} />
      <View style={styles.boxRow}>
        {real ? (
          <>
            <MiniBox label={strings.avgHeartRate} value={strings.notAvailable} sub={strings.needsWearable} />
            <MiniBox label={strings.vo2max} value={strings.notAvailable} sub={strings.needsWearable} />
          </>
        ) : (
          <>
            <MiniBox label={strings.avgHeartRate} value={sampleEnduranceStats.avgHeartRate.value} sub={sampleEnduranceStats.avgHeartRate.delta} />
            <MiniBox label={strings.vo2max} value={sampleEnduranceStats.vo2max.value} sub={sampleEnduranceStats.vo2max.delta} />
          </>
        )}
      </View>

      <Card style={styles.statsListCard}>
        <Text style={styles.sectionTitle}>{strings.moreEnduranceStats}</Text>
        <StatRow label={strings.avgPace} value={real ? (totals?.avgPaceLabel ?? strings.notAvailable) : sampleEnduranceStats.avgPace} />
        <StatRow label={strings.totalDistance} value={real ? (totals?.totalDistanceLabel ?? strings.notAvailable) : sampleEnduranceStats.totalDistance} />
        <StatRow label={strings.sessions} value={String(real ? (totals?.count ?? 0) : sampleEnduranceStats.sessions)} />
      </Card>
    </View>
  );
}
function MiniBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card style={[styles.miniBox, highlight && styles.miniBoxHighlight]}>
      <Text style={styles.miniBoxLabel}>{label}</Text>
      <Text style={styles.miniBoxValue}>{value}</Text>
      {sub ? <Text style={styles.miniBoxSub}>{sub}</Text> : null}
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  titleRow: { paddingHorizontal: spacing.screenX, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', fontFamily: fontFamily.bold },
  tabsWrap: { paddingHorizontal: spacing.screenX, marginBottom: spacing.md },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },

  overviewCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overviewText: { flex: 1 },
  overviewLabel: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '500', fontFamily: fontFamily.medium },
  overviewValue: { color: colors.text, fontSize: 19, fontWeight: '700', fontFamily: fontFamily.bold, marginTop: 2 },
  overviewDelta: { fontSize: 12, fontWeight: '600', fontFamily: fontFamily.semibold, marginTop: 2 },

  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chartLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
  chartValue: { color: colors.text, fontSize: 24, fontWeight: '700', fontFamily: fontFamily.bold, marginTop: 4 },
  deltaPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  deltaPillText: { fontSize: 12.5, fontWeight: '700', fontFamily: fontFamily.bold },
  sinceLabel: { color: colors.textTertiary, fontSize: 12, marginTop: 6 },

  boxRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  miniBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  miniBoxHighlight: { borderColor: colors.blue },
  miniBoxLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '600', fontFamily: fontFamily.semibold },
  miniBoxValue: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: fontFamily.bold, marginTop: 4 },
  miniBoxSub: { color: colors.textTertiary, fontSize: 10.5, marginTop: 2 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg },
  infoText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },

  tipCard: { marginTop: spacing.lg, backgroundColor: colors.cardAlt },
  tipTitle: { color: colors.amber, fontSize: 12.5, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: 4 },
  tipBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },

  sampleNote: { gap: 6, marginBottom: spacing.md },
  sampleHint: { color: colors.textTertiary, fontSize: 12.5, lineHeight: 18 },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: spacing.md },

  liftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  liftCard: { flexBasis: '47%', flexGrow: 1, gap: 4 },
  liftName: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', fontFamily: fontFamily.semibold },
  liftValue: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fontFamily.bold, marginBottom: 2 },
  liftDelta: { fontSize: 12, fontWeight: '700', fontFamily: fontFamily.bold },

  progressCard: { marginTop: spacing.lg, alignItems: 'center' },
  progressLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
  progressValue: { color: colors.amber, fontSize: 26, fontWeight: '800', fontFamily: fontFamily.extrabold, marginTop: 4 },
  progressSub: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },

  statsListCard: { marginTop: spacing.lg },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  statRowLabel: { color: colors.textSecondary, fontSize: 13 },
  statRowValue: { color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: fontFamily.bold },
});
