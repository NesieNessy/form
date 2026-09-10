import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors, fontFamily } from '@/theme/colors';

type Series = { label: string; color: string; values: number[] };

type Props = {
  categories: string[];
  series: Series[];
  width: number;
  height?: number;
};

export function StackedBarChart({ categories, series, width, height = 190 }: Props) {
  const padTop = 10;
  const padBottom = 24;
  const chartH = height - padTop - padBottom;
  const groupWidth = width / categories.length;
  const barWidth = Math.min(34, groupWidth * 0.5);

  return (
    <View>
      <Svg width={width} height={height}>
        {categories.map((cat, ci) => {
          const total = series.reduce((sum, s) => sum + s.values[ci], 0) || 100;
          let yCursor = height - padBottom;
          const x = groupWidth * ci + (groupWidth - barWidth) / 2;
          return (
            <React.Fragment key={cat}>
              {series.map((s) => {
                const segH = (s.values[ci] / total) * chartH;
                const y = yCursor - segH;
                yCursor -= segH;
                return <Rect key={s.label} x={x} y={y} width={barWidth} height={segH} rx={4} fill={s.color} />;
              })}
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.xLabels}>
        {categories.map((cat) => (
          <View key={cat} style={{ width: groupWidth, alignItems: 'center' }}>
            <Text style={styles.xLabel}>{cat}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    marginTop: 4,
  },
  xLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fontFamily.semibold,
  },
});
