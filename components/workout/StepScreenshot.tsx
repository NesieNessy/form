import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { WizardHeader } from './WizardHeader';
import { colors, fontFamily, radius, spacing } from '@/theme/colors';

type Props = {
  uri: string;
  onBack: () => void;
  onReplace: () => void;
  onContinue: () => void;
};

export function StepScreenshot({ uri, onBack, onReplace, onContinue }: Props) {
  return (
    <View style={styles.screen}>
      <WizardHeader onBack={onBack} />
      <View style={styles.content}>
        <View style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.preview} contentFit="cover" />
        </View>
        <Text style={styles.caption}>We'll scan this screenshot for exercises, sets, and intervals.</Text>
        <GradientButton label="Replace Image" variant="tertiary" onPress={onReplace} />
      </View>
      <View style={styles.footer}>
        <GradientButton label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, alignItems: 'center' },
  previewWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: { width: '100%', height: '100%' },
  caption: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontFamily: fontFamily.regular,
  },
  footer: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.lg },
});
