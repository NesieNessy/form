import { CheckCircle2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui/GradientButton';
import { Toast } from '@/components/ui/Toast';
import { FieldCard } from '@/components/workout/FieldCard';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

type Props = {
  durationLabel: string;
  onDurationChange: (v: string) => void;
  totalVolumeLabel: string;
  onTotalVolumeChange: (v: string) => void;
  onDone: () => void;
};

export function StepSaveContinue({
  durationLabel,
  onDurationChange,
  totalVolumeLabel,
  onTotalVolumeChange,
  onDone,
}: Props) {
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toastVisible) return;
    const t = setTimeout(() => setToastVisible(false), 1800);
    return () => clearTimeout(t);
  }, [toastVisible]);

  const showComingSoon = () => setToastVisible(true);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.successWrap}>
          <View style={styles.checkCircle}>
            <CheckCircle2 size={48} color={colors.teal} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>{strings.workoutSavedTitle}</Text>
          <Text style={styles.subtitle}>{strings.workoutSavedSubtitle}</Text>
        </View>

        <FieldCard label={strings.durationOptional} value={durationLabel} onChangeText={onDurationChange} placeholder="e.g. 28:14" />
        <FieldCard
          label={strings.totalVolumeOptional}
          value={totalVolumeLabel}
          onChangeText={onTotalVolumeChange}
          placeholder="e.g. 3,250 kg"
        />

        <GradientButton label={strings.addResults} variant="secondary" onPress={showComingSoon} style={styles.stubBtn} />
        <GradientButton label={strings.saveAsTemplate} variant="secondary" onPress={showComingSoon} style={styles.stubBtn} />
        <GradientButton label={strings.share} variant="secondary" onPress={showComingSoon} style={styles.stubBtn} />
      </ScrollView>
      <View style={styles.footer}>
        <GradientButton label={strings.done} onPress={onDone} />
      </View>
      <Toast message={strings.comingSoon} visible={toastVisible} />
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
  stubBtn: { marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
