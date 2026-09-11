import { CheckCircle2, Circle, Sparkles } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

const CHECKLIST = [
  strings.detectingText,
  strings.identifyingExercises,
  strings.detectingIntervals,
  strings.extractingDetails,
];

const STEP_DELAY_MS = 650;

type Props = {
  onDone: () => void;
};

// There's no real OCR/AI backend — this simulates one finishing, item by
// item, then hands control back so the wizard can move to the edit step
// pre-filled with the mock "analyzed" result.
export function StepAnalyzing({ onDone }: Props) {
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    if (doneCount >= CHECKLIST.length) {
      const finish = setTimeout(onDone, 500);
      return () => clearTimeout(finish);
    }
    const next = setTimeout(() => setDoneCount((c) => c + 1), STEP_DELAY_MS);
    return () => clearTimeout(next);
  }, [doneCount, onDone]);

  return (
    <View style={styles.screen}>
      <View style={styles.iconWrap}>
        <Sparkles size={32} color={colors.blue} />
      </View>
      <Text style={styles.title}>{strings.analyzingTitle}</Text>
      <Text style={styles.subtitle}>{strings.analyzingSubtitle}</Text>

      <View style={styles.checklist}>
        {CHECKLIST.map((item, i) => {
          const isDone = i < doneCount;
          return (
            <View key={item} style={styles.checkRow}>
              {isDone ? (
                <CheckCircle2 size={18} color={colors.green} />
              ) : (
                <Circle size={18} color={colors.textTertiary} />
              )}
              <Text style={[styles.checkLabel, isDone && styles.checkLabelDone]}>{item}…</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.blue}1A`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fontFamily.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
  },
  checklist: {
    marginTop: spacing.xl,
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkLabel: {
    color: colors.textTertiary,
    fontSize: 14,
    fontFamily: fontFamily.medium,
  },
  checkLabelDone: {
    color: colors.text,
  },
});
