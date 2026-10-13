import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

type Props = {
  isTemplate: boolean;
  onStart: () => void;
  onLogResults: () => void;
  onToggleTemplate: () => void;
  onShare: () => void;
  onDone: () => void;
};

export function StepSaveContinue({ isTemplate, onStart, onLogResults, onToggleTemplate, onShare, onDone }: Props) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successWrap}>
          <View style={styles.checkCircle}>
            <Icons.checkCircle size={48} color={colors.teal} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>{strings.workoutSavedTitle}</Text>
          <Text style={styles.subtitle}>{strings.workoutSavedSubtitle}</Text>
        </View>

        <GradientButton label={strings.startNow} variant="secondary" onPress={onStart} style={styles.btn} />
        <GradientButton label={strings.logResults} variant="secondary" onPress={onLogResults} style={styles.btn} />
        <GradientButton
          label={isTemplate ? strings.removeFromTemplates : strings.saveAsTemplate}
          variant="secondary"
          onPress={onToggleTemplate}
          style={styles.btn}
        />
        <GradientButton label={strings.share} variant="secondary" onPress={onShare} style={styles.btn} />
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label={strings.done} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  successWrap: { alignItems: 'center', marginBottom: spacing.xl },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 22, fontFamily: fontFamily.bold },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 4, fontFamily: fontFamily.regular },
  btn: { marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
