import React from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { markPaths, markViewBox, wordmarkPath, wordmarkViewBox } from '@/theme/logoPaths';

type Props = {
  size?: number;
  /** Full "FORM / FIND YOUR FORM." lockup when true, compact F-mark when false. */
  showTagline?: boolean;
};

const WORDMARK_ASPECT = 2022 / 778;
const MARK_ASPECT = 172 / 150;

export function Logo({ size = 22, showTagline = true }: Props) {
  const gradientId = showTagline ? 'formWordmarkGrad' : 'formMarkGrad';
  const gradientStops = (
    <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
      {colors.gradient.map((c, i) => (
        <Stop key={c} offset={i / (colors.gradient.length - 1)} stopColor={c} />
      ))}
    </LinearGradient>
  );

  if (!showTagline) {
    const height = size * 1.3;
    const width = height * MARK_ASPECT;
    return (
      <View style={{ width, height }}>
        <Svg width={width} height={height} viewBox={markViewBox}>
          <Defs>{gradientStops}</Defs>
          {markPaths.map((d) => (
            <Path key={d} d={d} fill={`url(#${gradientId})`} />
          ))}
        </Svg>
      </View>
    );
  }

  const height = size * 1.7;
  const width = height * WORDMARK_ASPECT;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={wordmarkViewBox}>
        <Defs>{gradientStops}</Defs>
        <Path d={wordmarkPath} fill={`url(#${gradientId})`} fillRule="evenodd" />
      </Svg>
    </View>
  );
}
