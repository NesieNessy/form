import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Share, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { Toast } from '@/components/ui/Toast';
import { PresetWorkoutCard } from '@/components/workout/PresetWorkoutCard';
import { strings } from '@/lib/strings';
import { formatPresetShareText, instantiatePreset, WORKOUT_PRESETS } from '@/lib/workoutPresets';
import { colors, fontFamily, spacing } from '@/theme/colors';

export default function TargetedWorkoutsScreen() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 1800);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const preset = WORKOUT_PRESETS[presetIndex];

  const goNext = () => setPresetIndex((i) => (i + 1) % WORKOUT_PRESETS.length);
  const goPrevious = () => setPresetIndex((i) => (i - 1 + WORKOUT_PRESETS.length) % WORKOUT_PRESETS.length);

  const toggleFavorite = () => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(preset.id)) next.delete(preset.id);
      else next.add(preset.id);
      return next;
    });
  };

  const handleShare = () => {
    Share.share({ message: formatPresetShareText(preset) }).catch(() => {});
  };

  const handleEdit = () => {
    const { title, sections } = instantiatePreset(preset);
    router.push({
      pathname: '/workout-new',
      params: { presetTitle: title, presetSections: JSON.stringify(sections) },
    });
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.targetedWorkoutsTitle} subtitle={preset.focus} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PresetWorkoutCard
          preset={preset}
          favorited={favorites.has(preset.id)}
          onToggleFavorite={toggleFavorite}
          onPrevious={goPrevious}
          onShare={handleShare}
          onEdit={handleEdit}
          onStub={setToastMessage}
        />

        <TouchableOpacity activeOpacity={0.85} onPress={goNext} style={styles.nextWrap}>
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.nextRingBorder}
          >
            <View style={styles.nextRingInner}>
              <Text style={styles.nextLabel}>{strings.next.toUpperCase()}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
      <Toast message={toastMessage ?? ''} visible={Boolean(toastMessage)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxl, alignItems: 'center', gap: spacing.xl },
  nextWrap: { alignItems: 'center', justifyContent: 'center' },
  nextRingBorder: { width: 96, height: 96, borderRadius: 48, padding: 3, alignItems: 'center', justifyContent: 'center' },
  nextRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: { color: colors.text, fontSize: 13, fontFamily: fontFamily.bold, letterSpacing: 0.5 },
});
