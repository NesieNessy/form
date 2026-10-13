import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { GradientButton } from '@/components/ui/GradientButton';
import { requestImport } from '@/lib/ai/client';
import { LIMITS } from '@/lib/ai/pipeline';
import { useAuthStore } from '@/lib/auth';
import { strings } from '@/lib/strings';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

/** Paste a workout or photograph one; the assistant turns it into a draft to review. */
export default function WorkoutImportScreen() {
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ media_type: string; data: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset?.base64) return;
    if (asset.base64.length > LIMITS.fileBase64Chars) {
      setError(strings.importPhotoTooLarge);
      return;
    }
    setPhoto({ media_type: asset.mimeType ?? 'image/jpeg', data: asset.base64 });
  };

  const submit = async () => {
    if (busy) return;
    if (!text.trim() && !photo) {
      setError(strings.importNothingYet);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await requestImport({ text: text.trim() || undefined, file: photo ?? undefined });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.replace({ pathname: '/proposal', params: { id: res.proposal.id } });
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.importTitle} subtitle={strings.importSubtitle} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!signedIn ? (
          <Card>
            <Text style={styles.body}>{strings.assistantNeedsAccount}</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.card}>
              <Text style={styles.label}>{strings.importPasteLabel}</Text>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={(v) => setText(v.slice(0, LIMITS.textChars))}
                placeholder={strings.importPlaceholder}
                placeholderTextColor={colors.textTertiary}
                multiline
                editable={!busy}
                accessibilityLabel={strings.importPasteLabel}
              />
              <Text style={styles.count}>
                {text.length}/{LIMITS.textChars}
              </Text>
            </Card>

            {photo ? (
              <Card style={styles.photoRow}>
                <Icons.checkCircle size={18} color={colors.teal} strokeWidth={iconStrokeWidth} />
                <Text style={[styles.body, { flex: 1 }]}>{strings.importPhotoAttached}</Text>
                <GradientButton label={strings.remove} variant="tertiary" onPress={() => setPhoto(null)} />
              </Card>
            ) : (
              <GradientButton label={strings.importAddPhoto} variant="secondary" onPress={() => void pickPhoto()} />
            )}

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            {busy ? (
              <Card style={styles.busy}>
                <ActivityIndicator color={colors.blue} />
                <Text style={styles.body}>{strings.importWorking}</Text>
              </Card>
            ) : (
              <GradientButton label={strings.importCreateDraft} onPress={() => void submit()} />
            )}

            <Text style={styles.footnote}>{strings.assistantFootnote}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: 6 },
  label: { color: colors.textSecondary, fontSize: 12.5, fontFamily: fontFamily.medium },
  input: {
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: fontFamily.regular,
    minHeight: 180,
    textAlignVertical: 'top',
    padding: spacing.md,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
  },
  count: { color: colors.textTertiary, fontSize: 11, textAlign: 'right', fontFamily: fontFamily.regular },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  busy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  error: { color: colors.red, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamily.regular },
  footnote: { color: colors.textTertiary, fontSize: 12, lineHeight: 18, fontFamily: fontFamily.regular },
});
