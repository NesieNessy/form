import { language } from '../strings';

/**
 * Text that is built in library code (validation, analysis, labels) rather
 * than taken from the catalogue: both languages side by side, picked by the
 * start-up language. Node tests run in English.
 */
export const tr = (en: string, de: string): string => (language === 'de' ? de : en);

/** A label table in both languages; the German table must cover the same keys. */
export const pick = <K extends string>(en: Record<K, string>, de: Record<K, string>): Record<K, string> => (language === 'de' ? de : en);

/** Weekday names from Sunday (index 0), as Date.getDay() counts. */
export const WEEKDAYS_SHORT = language === 'de' ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_INITIALS = language === 'de' ? ['S', 'M', 'D', 'M', 'D', 'F', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
