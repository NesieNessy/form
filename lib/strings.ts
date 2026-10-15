import { de } from './i18n/de';
import { en } from './i18n/en';
import { deviceLocale, readPreference } from './preferences';

/**
 * The app's text in English and German. The catalogues are lib/i18n/en.ts
 * (the source) and lib/i18n/de.ts, which must have every key. The language
 * is chosen once at start-up: the setting under More → Appearance & Language,
 * else the device's language.
 */

/** Same keys and argument lists as English, with any text as the value. */
export type Strings = Widen<typeof en>;
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => unknown
    ? (...args: A) => string
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Language = 'en' | 'de';
export type LanguagePreference = 'system' | Language;

const stored = readPreference('language');
export const languagePreference: LanguagePreference = stored === 'en' || stored === 'de' ? stored : 'system';
export const language: Language = languagePreference === 'system' ? (deviceLocale().toLowerCase().startsWith('de') ? 'de' : 'en') : languagePreference;
/** For dates and numbers: toLocaleDateString(locale, …). */
export const locale = language === 'de' ? 'de-DE' : 'en-US';
/** For clock times: 24-hour in both languages. */
export const timeLocale = language === 'de' ? 'de-DE' : 'en-GB';

export const strings: Strings = language === 'de' ? de : en;