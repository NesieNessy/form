/**
 * Small device settings that must be known before any screen is built
 * (theme, language), so they are read synchronously at start-up. This file
 * is used in Node (tests, the edge bundle) and keeps the defaults; the web
 * and native builds use preferences.web.ts and preferences.native.ts.
 */
export type PreferenceKey = 'theme' | 'language' | 'privacy';

export function readPreference(_key: PreferenceKey): string | null {
  return null;
}

export function writePreference(_key: PreferenceKey, _value: string): void {}

/** The device's preferred language tag, such as "de-AT". */
export function deviceLocale(): string {
  return 'en-US';
}

/** Applies a changed setting: the web app reloads, phones use it the next time the app opens. */
export function applyOnRestart(): 'reloaded' | 'next_launch' {
  return 'next_launch';
}

/** Whether the device asks for a light or dark look. */
export function systemScheme(): 'light' | 'dark' {
  return 'dark';
}
