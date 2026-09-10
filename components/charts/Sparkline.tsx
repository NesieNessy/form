import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { buildAreaPath, buildSmoothLinePath, scaleLinear } from '@/lib/chartMath';

type Props = {
  values: number[];
  color: string;
  width?: number;
  height?: number;
};

export function Sparkline({ values, color, width = 120, height = 40 }: Props) {
  if (values.length < 2) return null;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xScale = scaleLinear([0, values.length - 1], [pad, width - pad]);
  const yScale = scaleLinear([min, max], [height - pad, pad]);
  const points = values.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
  const gradId = `spark-${color.replace('#', '')}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={buildAreaPath(points, height)} fill={`url(#${gradId})`} />
      <Path d={buildSmoothLinePath(points)} stroke={color} strokeWidth={2.25} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
