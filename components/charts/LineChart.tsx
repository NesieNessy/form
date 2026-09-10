import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Circle, Stop } from 'react-native-svg';
import { buildAreaPath, buildSmoothLinePath, scaleLinear } from '@/lib/chartMath';
import { colors, fontFamily } from '@/theme/colors';

type Point = { label: string; value: number };

type Props = {
  points: Point[];
  color: string;
  width: number;
  height?: number;
};

// Restrained by design: no axes, gridlines, or tick labels — just the trend
// and its two endpoints. The current value lives in the surrounding card.
export function LineChart({ points, color, width, height = 160 }: Props) {
  const padX = 6;
  const padTop = 16;
  const padBottom = 26;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const xScale = scaleLinear([0, points.length - 1], [padX, width - padX]);
  const yScale = scaleLinear([min, max], [height - padBottom, padTop]);

  const coords = points.map((p, i) => ({ x: xScale(i), y: yScale(p.value) }));
  const gradId = `line-${color.replace('#', '')}`;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Path d={buildAreaPath(coords, height - padBottom)} fill={`url(#${gradId})`} />
        <Path d={buildSmoothLinePath(coords)} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {coords.map((c, i) =>
          i === coords.length - 1 ? (
            <Circle key={i} cx={c.x} cy={c.y} r={5} fill={color} stroke={colors.card} strokeWidth={2} />
          ) : null
        )}
      </Svg>

      <View style={styles.xLabels}>
        <Text style={styles.xLabel}>{points[0]?.label}</Text>
        <Text style={styles.xLabel}>{points[points.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xLabel: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fontFamily.medium,
  },
});
