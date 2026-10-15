import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, iconStrokeWidth, radius } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** The app's one checkbox look: a ticked box shows a check mark, not just a colour. The touchable around it carries the role and state. */
export function CheckBox({ checked }: { checked: boolean }) {
  return <View style={[styles.box, checked && styles.on]}>{checked ? <Icons.checkCircle size={14} color={colors.onAction} strokeWidth={iconStrokeWidth + 0.5} /> : null}</View>;
}

const styles = StyleSheet.create({
  box: { width: 22, height: 22, borderRadius: radius.sm - 2, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.action, borderColor: colors.action },
});
