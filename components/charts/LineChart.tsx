import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Circle, Stop } from 'react-native-svg';
import { buildAreaPath, buildSmoothLinePath, scaleLinear } from '@/lib/chartMath';
import { colors } from '@/theme/colors';

type Point = { label: string; value: number };

type Props = {
  points: Point[];
  color: string;
  width: number;
  height?: number;
  yTicks?: number;
  formatY?: (v: number) => string;
};

export function LineChart({ points, color, width, height = 180, yTicks = 5, formatY }: Props) {
  const padLeft = 34;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 26;

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const xScale = scaleLinear([0, points.length - 1], [padLeft, width - padRight]);
  const yScale = scaleLinear([min, max], [height - padBottom, padTop]);

  const coords = points.map((p, i) => ({ x: xScale(i), y: yScale(p.value) }));
  const gradId = `line-${color.replace('#', '')}`;

  const ticks = Array.from({ length: yTicks }, (_, i) => min + (span * 1.3 * i) / (yTicks - 1));

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {ticks.map((t, i) => {
          const y = yScale(t);
          return (
            <Line
              key={i}
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}

        <Path d={buildAreaPath(coords, height - padBottom)} fill={`url(#${gradId})`} />
        <Path d={buildSmoothLinePath(coords)} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />

        {coords.map((c, i) =>
          i === coords.length - 1 ? (
            <Circle key={i} cx={c.x} cy={c.y} r={5} fill={color} stroke={colors.bg} strokeWidth={2} />
          ) : null
        )}
      </Svg>

      <View style={[styles.yLabels, { height: height - padBottom, paddingTop: padTop }]} pointerEvents="none">
        {ticks
          .slice()
          .reverse()
          .map((t, i) => (
            <Text key={i} style={styles.yLabel}>
              {formatY ? formatY(t) : Math.round(t)}
            </Text>
          ))}
      </View>

      <View style={[styles.xLabels, { paddingLeft: padLeft, paddingRight: padRight }]}>
        {points.map((p, i) => (
          <Text key={i} style={styles.xLabel}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  yLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    justifyContent: 'space-between',
    width: 30,
  },
  yLabel: {
    color: colors.textTertiary,
    fontSize: 10,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xLabel: {
    color: colors.textTertiary,
    fontSize: 11,
  },
});
