import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { colors, fontFamily } from '@/theme/colors';

type Series = { label: string; color: string; values: number[] };

type Props = {
  categories: string[];
  series: [Series, Series];
  width: number;
  height?: number;
  unit?: string;
};

export function GroupedBarChart({ categories, series, width, height = 200, unit = 'kg' }: Props) {
  const padLeft = 8;
  const padRight = 8;
  const padTop = 26;
  const padBottom = 26;
  const chartH = height - padTop - padBottom;

  const max = Math.max(...series[0].values, ...series[1].values) * 1.2;

  const groupWidth = (width - padLeft - padRight) / categories.length;
  const barWidth = Math.min(26, groupWidth * 0.28);
  const gap = 6;

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} stroke={colors.chartGrid} strokeWidth={1} />
        {categories.map((cat, i) => {
          const groupCenter = padLeft + groupWidth * i + groupWidth / 2;
          return (
            <React.Fragment key={cat}>
              {series.map((s, si) => {
                const v = s.values[i];
                const barH = (v / max) * chartH;
                const x = groupCenter - barWidth - gap / 2 + si * (barWidth + gap);
                const y = height - padBottom - barH;
                return (
                  <Rect
                    key={s.label}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={6}
                    fill={s.color}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.valueRow} pointerEvents="none">
        {categories.map((cat, i) => {
          const groupCenter = (padLeft + groupWidth * i + groupWidth / 2) / width;
          return (
            <View key={cat} style={[styles.valueCol, { left: groupCenter * width - 40, width: 80 }]}>
              <View style={styles.valuePair}>
                <Text style={[styles.valueText, { color: series[0].color }]}>{series[0].values[i]}{unit}</Text>
                <Text style={[styles.valueText, { color: series[1].color }]}>{series[1].values[i]}{unit}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.xLabels, { paddingLeft: padLeft, paddingRight: padRight }]}>
        {categories.map((cat) => (
          <Text key={cat} style={styles.xLabel}>
            {cat}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  valueRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
  },
  valueCol: {
    position: 'absolute',
    alignItems: 'center',
  },
  valuePair: {
    flexDirection: 'row',
    gap: 6,
  },
  valueText: {
    fontSize: 10,
    fontFamily: fontFamily.bold,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  xLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fontFamily.semibold,
  },
});
