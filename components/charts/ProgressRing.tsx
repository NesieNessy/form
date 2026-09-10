import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme/colors';

type Props = {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
};

export function ProgressRing({ progress, size = 76, strokeWidth = 8, centerLabel, centerSub }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.ringGradient[0]} />
            <Stop offset="1" stopColor={colors.ringGradient[1]} />
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
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      {centerLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.centerLabel}>{centerLabel}</Text>
          {centerSub ? <Text style={styles.centerSub}>{centerSub}</Text> : null}
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
    fontWeight: '700',
  },
  centerSub: {
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 1,
  },
});
