import { ChevronDown } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GroupedBarChart } from '@/components/charts/GroupedBarChart';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { comparison } from '@/lib/mockData';
import { strings } from '@/lib/strings';
import { useContentWidth } from '@/lib/useContentWidth';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

export default function ComparisonScreen() {
  const width = useContentWidth();
  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

  const categories = useMemo(() => Object.keys(comparison.before.values), []);
  const beforeSeries = { label: comparison.before.label, color: comparison.before.color, values: categories.map((c) => comparison.before.values[c as keyof typeof comparison.before.values]) };
  const afterSeries = { label: comparison.after.label, color: comparison.after.color, values: categories.map((c) => comparison.after.values[c as keyof typeof comparison.after.values]) };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.comparisonTitle} subtitle={strings.comparisonSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.picker} activeOpacity={0.8}>
            <Text style={styles.pickerText}>{comparison.metric}</Text>
            <ChevronDown size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.picker} activeOpacity={0.8}>
            <Text style={styles.pickerText}>{comparison.exercise}</Text>
            <ChevronDown size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Card>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: beforeSeries.color }]} />
              <Text style={styles.legendLabel}>{beforeSeries.label}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: afterSeries.color }]} />
              <Text style={styles.legendLabel}>{afterSeries.label}</Text>
            </View>
          </View>
          <View style={{ height: spacing.md }} />
          <GroupedBarChart categories={categories} series={[beforeSeries, afterSeries]} width={chartWidth} />
        </Card>

        <Card style={styles.captionCard}>
          <Text style={styles.caption}>{comparison.caption}</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  pickerRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  picker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  pickerText: { color: colors.text, fontSize: 13, fontWeight: '600', fontFamily: fontFamily.semibold },
  legendRow: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textSecondary, fontSize: 11.5, fontWeight: '600', fontFamily: fontFamily.semibold },
  captionCard: { marginTop: spacing.lg, alignItems: 'center' },
  caption: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily: fontFamily.semibold, textAlign: 'center', lineHeight: 20 },
});
