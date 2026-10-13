import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/ui/GradientButton';
import { FieldCard } from '@/components/workout/FieldCard';
import { signIn, signUp } from '@/lib/auth';
import { strings } from '@/lib/strings';
import { colors, fontFamily, spacing } from '@/theme/colors';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || password.length < 6) {
      setMessage({ text: strings.emailAndPasswordRequired, tone: 'error' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signIn') {
        const { error } = await signIn(email, password);
        if (error) setMessage({ text: error, tone: 'error' });
      } else {
        const { error, needsConfirmation } = await signUp(email, password);
        if (error) setMessage({ text: error, tone: 'error' });
        else if (needsConfirmation) {
          setMessage({ text: strings.checkYourEmail, tone: 'info' });
          setMode('signIn');
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl * 2 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>FORM</Text>
        <Text style={styles.title}>{mode === 'signIn' ? strings.signInTitle : strings.signUpTitle}</Text>
        <Text style={styles.subtitle}>{mode === 'signIn' ? strings.signInSubtitle : strings.signUpSubtitle}</Text>

        <View style={{ height: spacing.xl }} />
        <FieldCard
          label={strings.email}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <FieldCard
          label={strings.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          onSubmitEditing={submit}
        />

        {message ? (
          <Text style={[styles.message, message.tone === 'error' && styles.messageError]} accessibilityLiveRegion="polite">
            {message.text}
          </Text>
        ) : null}

        <GradientButton label={busy ? '…' : mode === 'signIn' ? strings.signIn : strings.signUp} onPress={submit} />
        <GradientButton
          label={mode === 'signIn' ? strings.noAccountYet : strings.haveAccountAlready}
          variant="tertiary"
          style={{ marginTop: spacing.md }}
          onPress={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setMessage(null);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl },
  brand: { color: colors.textTertiary, fontSize: 13, fontFamily: fontFamily.bold, letterSpacing: 3, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 26, fontFamily: fontFamily.semibold },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 20, fontFamily: fontFamily.regular },
  message: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md, fontFamily: fontFamily.regular },
  messageError: { color: colors.red },
});
