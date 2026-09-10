import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, iconStrokeWidth, spacing } from '@/theme/colors';

type Props = {
  title?: string;
  subtitle?: string;
  onBack: () => void;
};

// Like DetailHeader, but the back action is caller-controlled instead of
// always calling router.back() — the workout wizard steps through a stack
// of in-memory steps inside a single route, not through the router.
export function WizardHeader({ title, subtitle, onBack }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + spacing.sm }}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={22} strokeWidth={iconStrokeWidth} color={colors.text} />
        </TouchableOpacity>
      </View>
      {title ? (
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fontFamily.semibold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontFamily: fontFamily.regular,
  },
});
