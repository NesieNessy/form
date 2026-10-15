import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';

import { strings } from '@/lib/strings';
import type { IconKey } from '@/lib/types';
import { useTrainingStats } from '@/lib/useTrainingStats';
import type { RangeKey } from '@/lib/workout/analytics';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Tile = { label: string; value: string; sub: string; icon: IconKey; color: string };

const RANGES = [
  { key: '4w', label: strings.range4w },
  { key: '3m', label: strings.range3m },
  { key: '1y', label: strings.range1y },
  { key: 'all', label: strings.all },
];
const signed = (n: number, suffix = '') => `${n > 0 ? '+' : ''}${n}${suffix}`;

export default function PerformanceOverviewScreen() {
  const [range, setRange] = useState<RangeKey>('4w');
  const { hasSessions, performance: p } = useTrainingStats(range);

  // A figure that cannot be computed yet shows as a dash, never as zero.
  const tiles: Tile[] = hasSessions
    ? [
        {
          label: strings.trainingVolume,
          value: p.volumeChangePct === undefined ? strings.notAvailable : signed(p.volumeChangePct, '%'),
          sub: strings.volumeSub,
          icon: 'trending-up',
          color: colors.blue,
        },
        {
          label: strings.workoutsPerWeek,
          value: p.sessionsPerWeek === undefined ? String(p.sessionCount) : String(p.sessionsPerWeek),
          sub:
            p.sessionsPerWeek === undefined
              ? strings.sessions.toLowerCase()
              : p.sessionsPerWeekDelta === undefined
                ? strings.perWeek
                : `${strings.perWeek} (${signed(p.sessionsPerWeekDelta)})`,
          icon: 'flame',
          color: colors.orange,
        },
        { label: strings.personalRecords, value: String(p.prCount), sub: strings.newPrs, icon: 'trophy', color: colors.amber },
        {
          label: strings.trainingConsistency,
          value: p.consistencyPct === undefined ? strings.notAvailable : `${p.consistencyPct}%`,
          sub: p.consistencyPct === undefined ? strings.noDataYet : `${p.plannedCompletedCount}/${p.plannedCount} ${strings.ofPlannedWorkouts}`,
          icon: 'check-circle',
          color: colors.green,
        },
      ]
    : [];

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.performanceOverviewTitle} subtitle={strings.performanceOverviewSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {hasSessions ? null : <Text style={styles.empty}>{strings.noInsightsYet}</Text>}
        <SegmentedTabs options={RANGES} value={range} onChange={(key) => setRange(key as RangeKey)} scrollable size="sm" />
        <View style={{ height: spacing.lg }} />

        <View style={styles.grid}>
          {tiles.map((item) => (
            <Card key={item.label} style={styles.tile}>
              <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
                <Icon name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.value}>{item.value}</Text>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.sub}>{item.sub}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, marginBottom: spacing.md, fontFamily: fontFamily.regular },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 4 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  value: { color: colors.text, fontSize: 20, fontWeight: '800', fontFamily: fontFamily.extrabold },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '600', fontFamily: fontFamily.semibold, marginTop: 2 },
  sub: { color: colors.textTertiary, fontSize: 11, marginTop: 1 },
});
