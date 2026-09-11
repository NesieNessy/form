import { Info } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LineChart } from '@/components/charts/LineChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { Card } from '@/components/ui/Card';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { TabHeader } from '@/components/ui/TabHeader';
import {
  bodyMetricHistory,
  enduranceSessions,
  enduranceStats,
  strengthLifts,
  strengthOverallProgressPct,
  timeRanges,
  trendsOverview,
} from '@/lib/mockData';
import { useContentWidth } from '@/lib/useContentWidth';
import { strings } from '@/lib/strings';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

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

export default function TrendsScreen() {
  const [mainTab, setMainTab] = useState('overview');
  const [range, setRange] = useState('3m');
  const width = useContentWidth();
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

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
        <SegmentedTabs options={timeRanges.map((r) => ({ key: r.key, label: r.label }))} value={range} onChange={setRange} scrollable size="sm" />
        <View style={{ height: spacing.lg }} />

        {mainTab === 'overview' && <OverviewTab chartWidth={Math.min(120, chartWidth * 0.32)} />}
        {mainTab === 'body-data' && <BodyDataTab chartWidth={chartWidth} />}
        {mainTab === 'strength' && <StrengthTab chartWidth={chartWidth} />}
        {mainTab === 'endurance' && <EnduranceTab chartWidth={chartWidth} />}
      </ScrollView>
    </View>
  );
}

function OverviewTab({ chartWidth }: { chartWidth: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      {trendsOverview.map((item) => (
        <Card key={item.key} style={styles.overviewCard}>
          <View style={styles.overviewText}>
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
        <Info size={16} color={colors.textSecondary} />
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

function StrengthTab({ chartWidth }: { chartWidth: number }) {
  const sparkWidth = (chartWidth - spacing.md) / 2 - spacing.lg;
  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.yourStrengthProgress}</Text>
      <View style={styles.liftGrid}>
        {strengthLifts.map((lift) => (
          <Card key={lift.exercise} style={styles.liftCard}>
            <Text style={styles.liftName}>{lift.exercise}</Text>
            <Text style={styles.liftValue}>
              {lift.current} kg{' '}
              <Text style={[styles.liftDelta, { color: lift.color }]}>+{lift.deltaFromStart} kg</Text>
            </Text>
            <Sparkline values={lift.points.map((p) => p.value)} color={lift.color} width={sparkWidth} height={44} />
          </Card>
        ))}
      </View>

      <Card style={styles.progressCard}>
        <Text style={styles.progressLabel}>{strings.overallProgress}</Text>
        <Text style={styles.progressValue}>+{strengthOverallProgressPct}%</Text>
        <Text style={styles.progressSub}>(vs. start)</Text>
      </Card>
    </View>
  );
}

function EnduranceTab({ chartWidth }: { chartWidth: number }) {
  const [distance, setDistance] = useState('5km');
  const session = enduranceSessions[0];

  return (
    <View>
      <Text style={styles.sectionTitle}>{strings.endurancePerformance}</Text>
      <SegmentedTabs options={DISTANCE_TABS} value={distance} onChange={setDistance} scrollable size="sm" />
      <View style={{ height: spacing.lg }} />

      <Card>
        <View style={styles.chartHeaderRow}>
          <View>
            <Text style={styles.chartLabel}>{strings.distance5km}</Text>
            <Text style={styles.chartValue}>{session.currentLabel}</Text>
          </View>
          <View style={[styles.deltaPill, { backgroundColor: `${colors.teal}22` }]}>
            <Text style={[styles.deltaPillText, { color: colors.teal }]}>{session.deltaPct}%</Text>
          </View>
        </View>
        <Text style={styles.sinceLabel}>{session.deltaLabel}</Text>
        <View style={{ height: spacing.md }} />
        <LineChart points={session.points} color={colors.teal} width={chartWidth} />
      </Card>

      <View style={{ height: spacing.md }} />
      <View style={styles.boxRow}>
        <MiniBox label={strings.avgHeartRate} value={enduranceStats.avgHeartRate.value} sub={enduranceStats.avgHeartRate.delta} />
        <MiniBox label={strings.vo2max} value={enduranceStats.vo2max.value} sub={enduranceStats.vo2max.delta} />
      </View>

      <Card style={styles.statsListCard}>
        <Text style={styles.sectionTitle}>{strings.moreEnduranceStats}</Text>
        <StatRow label={strings.avgPace} value={enduranceStats.avgPace} />
        <StatRow label={strings.totalDistance} value={enduranceStats.totalDistance} />
        <StatRow label={strings.sessions} value={String(enduranceStats.sessions)} />
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
