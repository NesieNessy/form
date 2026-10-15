import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  message: string;
  visible: boolean;
};

export function Toast({ message, visible }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: reduced ? 0 : 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity, reduced]);

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.screenX,
    right: spacing.screenX,
    bottom: spacing.xxl,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  text: { color: colors.text, fontSize: 13.5, fontFamily: fontFamily.semibold },
});
