import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { ChipSelect } from '@/components/ui/ChipSelect';
import { GradientButton } from '@/components/ui/GradientButton';
import { Logo } from '@/components/ui/Logo';
import { Stepper } from '@/components/ui/Stepper';
import { SPORT_LABEL, equipmentLabel } from '@/lib/athlete/labels';
import { EQUIPMENT_OPTIONS } from '@/lib/athlete/model';
import { WEEKDAYS_SHORT } from '@/lib/i18n/tr';
import { writePreference } from '@/lib/preferences';
import { strings } from '@/lib/strings';
import { SPORTS } from '@/lib/workout/model';
import { useWorkoutsStore } from '@/lib/workoutsStore';
import { colors, fontFamily, iconStrokeWidth, radius, spacing } from '@/theme/colors';
import { Icons } from '@/theme/icons';

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * First run: what FORM does with the athlete's data, then the few things
 * that make suggestions fit. Every step can be skipped and changed later
 * under Profile.
 */
export default function WelcomeScreen() {
  const profile = useWorkoutsStore((s) => s.profile);
  const updateProfile = useWorkoutsStore((s) => s.updateProfile);
  const [step, setStep] = useState(0);

  const finish = () => {
    writePreference('onboarded', 'done');
    router.replace('/');
  };
  const next = () => (step === 3 ? finish() : setStep(step + 1));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Logo size={26} showTagline={false} />
          <Text style={styles.progress} accessibilityLabel={strings.onboardingStep(step + 1, 4)}>
            {strings.onboardingStep(step + 1, 4)}
          </Text>
        </View>

        {step === 0 ? (
          <>
            <Text style={styles.title}>{strings.welcomeTitle}</Text>
            <Text style={styles.body}>{strings.welcomeBody}</Text>
            {[
              { icon: Icons.personStanding, text: strings.welcomeOwnData },
              { icon: Icons.users, text: strings.welcomeSharing },
              { icon: Icons.sparkles, text: strings.welcomeAi },
            ].map((p) => (
              <Card key={p.text} style={styles.point}>
                <p.icon size={18} color={colors.action} strokeWidth={iconStrokeWidth} />
                <Text style={[styles.body, { flex: 1 }]}>{p.text}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.title}>{strings.yourSports}</Text>
            <Text style={styles.body}>{strings.onboardingSportsBody}</Text>
            <ChipSelect options={SPORTS.map((s) => ({ key: s, label: SPORT_LABEL[s] }))} selected={profile.sports} onToggle={(s) => updateProfile({ sports: toggle(profile.sports, s) })} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.title}>{strings.yourEquipment}</Text>
            <Text style={styles.body}>{strings.onboardingEquipmentBody}</Text>
            <ChipSelect options={EQUIPMENT_OPTIONS.map((e) => ({ key: e, label: equipmentLabel(e) }))} selected={profile.equipment} onToggle={(e) => updateProfile({ equipment: toggle(profile.equipment, e) })} />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.title}>{strings.trainingRhythm}</Text>
            <Text style={styles.body}>{strings.onboardingRhythmBody}</Text>
            <Card style={styles.card}>
              <Text style={styles.label}>{strings.sessionsPerWeek}</Text>
              <Stepper value={profile.weeklySessionTarget} onChange={(n) => updateProfile({ weeklySessionTarget: n })} min={1} max={14} />
            </Card>
            <Card style={styles.card}>
              <Text style={styles.label}>{strings.usualTrainingDays}</Text>
              <ChipSelect options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ key: d, label: WEEKDAYS_SHORT[d] }))} selected={profile.availableDays} onToggle={(d) => updateProfile({ availableDays: toggle(profile.availableDays, d) })} />
            </Card>
          </>
        ) : null}

        <GradientButton label={step === 3 ? strings.onboardingDone : strings.continue} onPress={next} style={{ marginTop: spacing.lg }} />
        {step > 0 && step < 3 ? <GradientButton label={strings.onboardingSkipStep} variant="tertiary" onPress={next} /> : null}
        {step === 0 ? <GradientButton label={strings.onboardingSkipAll} variant="tertiary" onPress={finish} /> : null}
        <Text style={styles.hint}>{strings.onboardingLater}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.screenX, paddingTop: spacing.xxl, gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  progress: { color: colors.textTertiary, fontSize: 12.5, fontFamily: fontFamily.medium },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontFamily: fontFamily.bold },
  body: { color: colors.textSecondary, fontSize: 14.5, lineHeight: 21, fontFamily: fontFamily.regular },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderRadius: radius.card },
  card: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.medium },
  hint: { color: colors.textTertiary, fontSize: 12, lineHeight: 17, textAlign: 'center', fontFamily: fontFamily.regular },
});
