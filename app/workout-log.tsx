import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockResultEditor } from '@/components/player/BlockResultEditor';
import { SessionWrapUp } from '@/components/player/SessionWrapUp';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { WizardHeader } from '@/components/workout/WizardHeader';
import { strings } from '@/lib/strings';
import { blockLabel, formatBlockHeadline } from '@/lib/workout/format';
import { emptyBlockResult } from '@/lib/workout/scoring';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, spacing } from '@/theme/colors';

/** Logging results after the fact, without running the timer. */
export default function WorkoutLogScreen() {
  const insets = useSafeAreaInsets();
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>();
  const session = useWorkoutsStore((s) => (sessionId ? s.sessions[sessionId] : undefined));
  const putBlockResult = useWorkoutsStore((s) => s.putBlockResult);
  const completeSession = useWorkoutsStore((s) => s.completeSession);
  const discardSession = useWorkoutsStore((s) => s.discardSession);

  const [rpe, setRpe] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');

  if (!session || !sessionId || session.status !== 'in_progress') {
    return (
      <View style={styles.screen}>
        <WizardHeader title={strings.logResults} onBack={() => router.back()} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>{strings.sessionMissing}</Text>
        </View>
      </View>
    );
  }

  const save = () => {
    const scheduledId = session.scheduledWorkoutId;
    completeSession(sessionId, { rpe, notes });
    // Opened from the detail screen: go back to it, now showing the results, instead of stacking a second copy.
    if (from === 'detail') router.back();
    else if (scheduledId) router.replace(`/workout-detail?id=${scheduledId}`);
    else router.back();
  };

  return (
    <View style={styles.screen}>
      <WizardHeader
        title={strings.logResults}
        subtitle={session.prescribed.title}
        onBack={() => {
          // Nothing was saved yet, so backing out leaves no half-logged session behind.
          discardSession(sessionId);
          router.back();
        }}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {session.prescribed.blocks.map((block) => {
          const result = session.blockResults.find((r) => r.blockId === block.id) ?? emptyBlockResult(block);
          return (
            <Card key={block.id} style={styles.card}>
              <View>
                <Text style={styles.blockLabel}>{blockLabel(block)}</Text>
                <Text style={styles.blockHeadline}>{formatBlockHeadline(block)}</Text>
              </View>
              <BlockResultEditor block={block} result={result} onChange={(next) => putBlockResult(sessionId, next)} />
            </Card>
          );
        })}
        <SessionWrapUp rpe={rpe} onRpeChange={setRpe} notes={notes} onNotesChange={setNotes} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <GradientButton label={strings.saveResults} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.md },
  blockLabel: { color: colors.text, fontSize: 15, fontFamily: fontFamily.bold },
  blockHeadline: { color: colors.textTertiary, fontSize: 12.5, marginTop: 2, fontFamily: fontFamily.medium },
  footer: { paddingHorizontal: spacing.screenX, paddingTop: spacing.sm },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { color: colors.textSecondary, fontSize: 14, fontFamily: fontFamily.regular },
});
