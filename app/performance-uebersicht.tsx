import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { performanceOverview, timeRanges } from '@/lib/mockData';
import { colors, radius, spacing } from '@/theme/colors';

export default function PerformanceUebersichtScreen() {
  const [range, setRange] = useState('4w');

  return (
    <View style={styles.screen}>
      <DetailHeader title="Performance Übersicht" subtitle="Alle wichtigen Kennzahlen." />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedTabs options={timeRanges} value={range} onChange={setRange} scrollable size="sm" />
        <View style={{ height: spacing.lg }} />

        <View style={styles.grid}>
          {performanceOverview.map((item) => (
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
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
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
  value: { color: colors.text, fontSize: 20, fontWeight: '800' },
  label: { color: colors.text, fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  sub: { color: colors.textTertiary, fontSize: 11, marginTop: 1 },
});
