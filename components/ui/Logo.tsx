import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fontFamily } from '@/theme/colors';

type Props = {
  size?: number;
  showTagline?: boolean;
};

export function Logo({ size = 22, showTagline = true }: Props) {
  const width = size * 4.6;
  const height = size * 1.25;

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="0">
            {colors.gradient.map((c, i) => (
              <Stop key={c} offset={i / (colors.gradient.length - 1)} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <SvgText
          x="0"
          y={height * 0.8}
          fontSize={size}
          fontWeight="800"
          letterSpacing={1}
          fill="url(#logoGrad)"
        >
          FORM
        </SvgText>
      </Svg>
      {showTagline ? <Text style={[styles.tagline, { fontSize: size * 0.28 }]}>FIND YOUR FORM</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  tagline: {
    color: colors.textTertiary,
    letterSpacing: 2,
    marginTop: -2,
    fontFamily: fontFamily.semibold,
  },
});
