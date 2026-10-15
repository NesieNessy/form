import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { DetailHeader } from '@/components/ui/DetailHeader';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { applyOnRestart, writePreference } from '@/lib/preferences';
import { usePrivacy } from '@/lib/privacy';
import { languagePreference, strings, type LanguagePreference } from '@/lib/strings';
import { colors, fontFamily, spacing, themePreference, type ThemePreference } from '@/theme/colors';

/** Theme and language. Both apply at start-up, so changing one reloads the web app or waits for the next launch. */
export default function SettingsScreen() {
  const [theme, setTheme] = useState<ThemePreference>(themePreference);
  const [lang, setLang] = useState<LanguagePreference>(languagePreference);
  const [note, setNote] = useState<string | null>(null);
  const hideSensitive = usePrivacy((s) => s.hideSensitive);
  const setHideSensitive = usePrivacy((s) => s.setHideSensitive);

  const save = (key: 'theme' | 'language', value: string) => {
    writePreference(key, value);
    if (applyOnRestart() === 'next_launch') setNote(strings.settingsNextLaunch);
  };

  return (
    <View style={styles.screen}>
      <DetailHeader title={strings.settingsTitle} subtitle={strings.settingsSubtitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.label}>{strings.themeLabel}</Text>
          <SegmentedTabs
            options={[
              { key: 'system', label: strings.themeSystem },
              { key: 'light', label: strings.themeLight },
              { key: 'dark', label: strings.themeDark },
            ]}
            value={theme}
            onChange={(k) => {
              setTheme(k as ThemePreference);
              save('theme', k);
            }}
            size="sm"
          />
        </Card>
        <Card style={styles.card}>
          <Text style={styles.label}>{strings.languageLabel}</Text>
          <SegmentedTabs
            options={[
              { key: 'system', label: strings.languageSystem },
              { key: 'en', label: strings.languageEnglish },
              { key: 'de', label: strings.languageGerman },
            ]}
            value={lang}
            onChange={(k) => {
              setLang(k as LanguagePreference);
              save('language', k);
            }}
            size="sm"
          />
        </Card>
        <Card style={styles.card}>
          <Text style={styles.label}>{strings.privacyLabel}</Text>
          <View style={styles.row}>
            <Text style={[styles.toggle, { flex: 1 }]}>{strings.privacyToggle}</Text>
            <Switch value={hideSensitive} onValueChange={setHideSensitive} accessibilityLabel={strings.privacyToggle} trackColor={{ true: colors.action, false: colors.cardAlt }} />
          </View>
          <Text style={styles.note}>{strings.privacyHint}</Text>
        </Card>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.sm },
  label: { color: colors.textSecondary, fontSize: 13, fontFamily: fontFamily.medium },
  note: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, fontFamily: fontFamily.regular },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggle: { color: colors.text, fontSize: 14, fontFamily: fontFamily.semibold },
});
