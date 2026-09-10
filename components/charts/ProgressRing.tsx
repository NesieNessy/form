import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fontFamily } from '@/theme/colors';

type Props = {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
  centerLabelStyle?: TextStyle;
  centerSubStyle?: TextStyle;
};

export function ProgressRing({
  progress,
  size = 76,
  strokeWidth = 8,
  centerLabel,
  centerSub,
  centerLabelStyle,
  centerSubStyle,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            {colors.gradient.map((c, i) => (
              <Stop key={c} offset={i / (colors.gradient.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {centerLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={[styles.centerLabel, centerLabelStyle]}>{centerLabel}</Text>
          {centerSub ? <Text style={[styles.centerSub, centerSubStyle]}>{centerSub}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fontFamily.bold,
  },
  centerSub: {
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 1,
    fontFamily: fontFamily.regular,
  },
});
