import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { buildSmoothLinePath, scaleLinear } from '@/lib/chartMath';
import { colors } from '@/theme/colors';

type Series = { label: string; color: string; values: number[] };

type Props = {
  categories: string[];
  series: Series[];
  width: number;
  height?: number;
};

export function MultiLineChart({ categories, series, width, height = 190 }: Props) {
  const padLeft = 8;
  const padRight = 8;
  const padTop = 14;
  const padBottom = 26;

  const xScale = scaleLinear([0, categories.length - 1], [padLeft, width - padRight]);

  return (
    <View>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={padLeft}
            x2={width - padRight}
            y1={padTop + (height - padTop - padBottom) * f}
            y2={padTop + (height - padTop - padBottom) * f}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}

        {series.map((s) => {
          const min = Math.min(...s.values);
          const max = Math.max(...s.values);
          const yScale = scaleLinear([min, max], [height - padBottom, padTop]);
          const coords = s.values.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
          return (
            <React.Fragment key={s.label}>
              <Path d={buildSmoothLinePath(coords)} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              <Circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r={4.5} fill={s.color} stroke={colors.bg} strokeWidth={2} />
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={[styles.xLabels, { paddingLeft: padLeft, paddingRight: padRight }]}>
        {categories.map((c, i) => (
          <Text key={i} style={styles.xLabel}>
            {c}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  xLabel: {
    color: colors.textTertiary,
    fontSize: 10,
  },
});
