import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '@/components/charts/LineChart';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { metricWithUnit } from '@/lib/health/format';
import { metricSeries } from '@/lib/health/logic';
import type { MetricKey } from '@/lib/health/model';
import { locale, strings } from '@/lib/strings';
import { useContentWidth } from '@/lib/useContentWidth';
import { rangeStartMs, type RangeKey } from '@/lib/workout/analytics';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing, tabular } from '@/theme/colors';

const RANGES = [
  { key: '4w', label: strings.range4w },
  { key: '3m', label: strings.range3m },
  { key: '1y', label: strings.range1y },
  { key: 'all', label: strings.all },
];
const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'weight_kg', label: strings.weight, color: colors.blue },
  { key: 'body_fat_pct', label: strings.bodyFat, color: colors.pink },
];
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

/** Body composition from the athlete's own measurements: the first and latest value in the period, and the line between. */
export default function BodyDevelopmentScreen() {
  const [range, setRange] = useState<RangeKey>('3m');
  const observations = useWorkoutsStore((s) => s.observations);
  const chartWidth = useContentWidth() - spacing.screenX * 2 - spacing.lg * 2;
  const from = rangeStartMs(range, Date.now());

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.bodyDevelopmentTitle} subtitle={strings.bodyDevelopmentSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs options={RANGES} value={range} onChange={(k) => setRange(k as RangeKey)} scrollable size="sm" />
        {METRICS.map((m) => {
          const points = metricSeries(Object.values(observations), m.key).filter((p) => new Date(`${p.date}T12:00:00`).getTime() >= from);
          const first = points[0];
          const last = points[points.length - 1];
          return (
            <Card key={m.key} style={styles.card}>
              <Text style={styles.title}>{m.label}</Text>
              {!last ? (
                <Text style={styles.empty}>{strings.noBodyDataYet}</Text>
              ) : (
                <>
                  <View style={styles.row}>
                    <View style={styles.box}>
                      <Text style={styles.label}>{`${strings.before} · ${shortDay(first.date)}`}</Text>
                      <Text style={styles.value}>{metricWithUnit(m.key, first.value)}</Text>
                    </View>
                    <View style={styles.box}>
                      <Text style={styles.label}>{`${strings.now} · ${shortDay(last.date)}`}</Text>
                      <Text style={styles.value}>{metricWithUnit(m.key, last.value)}</Text>
                    </View>
                  </View>
                  {points.length >= 2 ? <LineChart points={points.map((p) => ({ label: shortDay(p.date), value: p.value }))} color={m.color} width={chartWidth} /> : null}
                  <Text style={styles.hint}>{strings.bodyMeasuredHint(points.length)}</Text>
                </>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  row: { flexDirection: 'row', gap: spacing.md },
  box: { flex: 1, gap: 2 },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  value: { color: colors.text, fontSize: 20, fontFamily: fontFamily.bold, ...tabular },
  empty: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, fontFamily: fontFamily.regular },
});
