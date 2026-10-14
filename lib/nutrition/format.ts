import { strings } from '../strings';
import type { NutrientTotal } from './engine';
import { formatNutrient, type FoodLogEntry, type NutrientKey, type Quantity, type Range } from './model';

export function entryName(e: FoodLogEntry): string {
  return e.food?.name ?? e.label ?? 'Quick add';
}

export function quantityText(q: Quantity): string {
  const n = Math.round(q.value * 10) / 10;
  if (q.unit === 'serving') return `${n} × ${q.servingLabel ?? 'serving'}`;
  return `${n} ${q.unit}`;
}

export function entryAmount(e: FoodLogEntry): string {
  if (e.quantity) return quantityText(e.quantity);
  return e.fluidMl ? `${Math.round(e.fluidMl)} ml` : '';
}

/** A day's total for one nutrient: "at least" when some entries did not state it, "unknown" when none did. */
export function totalText(key: NutrientKey, t: NutrientTotal, entries: number): string {
  if (entries === 0) return '–';
  if (t.missing === entries) return 'unknown';
  const value = formatNutrient(key, t.value);
  return t.missing > 0 ? strings.atLeast(value) : value;
}

export function rangeText(r: Range | undefined, unit: string): string | undefined {
  if (!r || (r.min === undefined && r.max === undefined)) return undefined;
  return `${strings.targetRange(r.min !== undefined ? String(r.min) : undefined, r.max !== undefined ? String(r.max) : undefined)} ${unit}`;
}

export function fluidText(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toFixed(2)} l` : `${Math.round(ml)} ml`;
}

export function formatDayLabel(date: string, today: string): string {
  if (date === today) return strings.today;
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
