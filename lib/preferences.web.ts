import type { PreferenceKey } from './preferences';

export type { PreferenceKey };

const KEY = (k: PreferenceKey) => `form-pref-${k}`;

export function readPreference(key: PreferenceKey): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY(key));
  } catch {
    return null;
  }
}

export function writePreference(key: PreferenceKey, value: string): void {
  try {
    localStorage.setItem(KEY(key), value);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

export function deviceLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
}

export function applyOnRestart(): 'reloaded' | 'next_launch' {
  if (typeof window !== 'undefined') window.location.reload();
  return 'reloaded';
}

export function systemScheme(): 'light' | 'dark' {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
