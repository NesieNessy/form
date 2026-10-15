import { Appearance } from 'react-native';
import { File, Paths } from 'expo-file-system';
import type { PreferenceKey } from './preferences';

export type { PreferenceKey };

const file = (k: PreferenceKey) => new File(Paths.document, `form-pref-${k}.txt`);

export function readPreference(key: PreferenceKey): string | null {
  try {
    const f = file(key);
    return f.exists ? f.textSync().trim() || null : null;
  } catch {
    return null;
  }
}

export function writePreference(key: PreferenceKey, value: string): void {
  try {
    const f = file(key);
    if (!f.exists) f.create();
    f.write(value);
  } catch {
    // Not saved; the default applies next time.
  }
}

export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

export function applyOnRestart(): 'reloaded' | 'next_launch' {
  return 'next_launch';
}

export function systemScheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}
