import { tr } from '../i18n/tr';
/**
 * Nutrition tracking (docs/concepts/nutrition_training_tracking_concept_en.md).
 *
 * A food states its nutrients per 100 g, per 100 ml or per serving. A log
 * entry keeps a snapshot of the food as it was when logged, the quantity,
 * and the nutrients computed from both, so later edits to a food never
 * rewrite history. An unknown nutrient is `null` (or absent), never zero.
 */

export type NutrientKey = 'energy_kcal' | 'protein_g' | 'carbohydrate_g' | 'fat_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg' | 'caffeine_mg';

export type Nutrients = Partial<Record<NutrientKey, number | null>>;

export type NutrientMeta = { label: string; unit: 'kcal' | 'g' | 'mg'; decimals: number; /** Upper plausibility bound per 100 g or 100 ml. */ maxPer100: number };

export const NUTRIENTS: Record<NutrientKey, NutrientMeta> = {
  energy_kcal: { label: tr('Energy', 'Energie'), unit: 'kcal', decimals: 0, maxPer100: 900 },
  protein_g: { label: tr('Protein', 'Eiweiß'), unit: 'g', decimals: 1, maxPer100: 100 },
  carbohydrate_g: { label: tr('Carbohydrate', 'Kohlenhydrate'), unit: 'g', decimals: 1, maxPer100: 100 },
  fat_g: { label: tr('Fat', 'Fett'), unit: 'g', decimals: 1, maxPer100: 100 },
  fiber_g: { label: tr('Fiber', 'Ballaststoffe'), unit: 'g', decimals: 1, maxPer100: 100 },
  sugar_g: { label: tr('Sugar', 'Zucker'), unit: 'g', decimals: 1, maxPer100: 100 },
  sodium_mg: { label: tr('Sodium', 'Natrium'), unit: 'mg', decimals: 0, maxPer100: 40_000 },
  caffeine_mg: { label: tr('Caffeine', 'Koffein'), unit: 'mg', decimals: 0, maxPer100: 5_000 },
};

export const NUTRIENT_ORDER: NutrientKey[] = ['energy_kcal', 'protein_g', 'carbohydrate_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'caffeine_mg'];
export const MACROS: NutrientKey[] = ['protein_g', 'carbohydrate_g', 'fat_g'];

export const KJ_PER_KCAL = 4.184;

/** What the stated nutrient values refer to. */
export type NutrientBasis = 'per_100g' | 'per_100ml' | 'per_serving';

/** A named portion, e.g. "1 medium banana" = 118 g. */
export type ServingDefinition = { label: string; grams?: number; ml?: number };

export type FoodSource = 'catalog' | 'user';

export type Food = {
  id: string;
  name: string;
  brand?: string;
  basis: NutrientBasis;
  nutrients: Nutrients;
  servings: ServingDefinition[];
  /** Grams per millilitre, when known, so a drink can be logged by weight or volume. */
  densityGPerMl?: number;
  /** Counts towards fluid intake. */
  isFluid?: boolean;
  source: FoodSource;
  /** Where the numbers come from, e.g. a label or a reference list and its version. */
  sourceNote?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'during_workout' | 'post_workout';

export const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: tr('Breakfast', 'Frühstück') },
  { key: 'lunch', label: tr('Lunch', 'Mittagessen') },
  { key: 'dinner', label: tr('Dinner', 'Abendessen') },
  { key: 'snack', label: tr('Snack', 'Snack') },
  { key: 'pre_workout', label: tr('Before training', 'Vor dem Training') },
  { key: 'during_workout', label: tr('During training', 'Während des Trainings') },
  { key: 'post_workout', label: tr('After training', 'Nach dem Training') },
];

export type QuantityUnit = 'g' | 'ml' | 'serving';

export type Quantity = {
  value: number;
  unit: QuantityUnit;
  /** For unit 'serving': which serving. */
  servingLabel?: string;
};

/** The food as it was when logged. */
export type FoodSnapshot = Pick<Food, 'id' | 'name' | 'brand' | 'basis' | 'nutrients' | 'servings' | 'densityGPerMl' | 'isFluid' | 'source' | 'sourceNote'>;

export type EntryMethod = 'search' | 'quick_add' | 'saved_meal' | 'ai_draft';

export type FoodLogEntry = {
  id: string;
  consumedAt: number;
  /** The athlete's calendar day, YYYY-MM-DD, fixed when logged so travel does not move meals. */
  localDate: string;
  mealType: MealType;
  /** Absent for a quick-add, which has nutrients but no food. */
  food?: FoodSnapshot;
  /** Absent for a quick-add. */
  quantity?: Quantity;
  /** Name shown for a quick-add. */
  label?: string;
  nutrients: Nutrients;
  /** Fluid volume this entry adds, when it is a drink. */
  fluidMl?: number;
  /** A workout session this was eaten or drunk for. */
  sessionId?: string;
  entryMethod: EntryMethod;
  /** The quantity or values are estimates. */
  estimated: boolean;
  note?: string;
  /** Increases with every correction. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type SavedMealItem = { food: FoodSnapshot; quantity: Quantity };

export type SavedMeal = {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

/** A range target; either end may be open. */
export type Range = { min?: number; max?: number };

/** How demanding a day's training is, from the planned workouts' total duration. */
export type DayType = 'rest_or_light' | 'moderate' | 'high' | 'very_high';

export type NutritionTargets = {
  energy_kcal?: Range;
  protein_g?: Range;
  carbohydrate_g?: Range;
  fat_g?: Range;
  fluid_ml?: Range;
  /** Carbohydrate ranges that follow the day's planned training; when set they replace `carbohydrate_g`. */
  carbohydrateByDayType?: Record<DayType, Range>;
  /** manual: set by the athlete. suggested: proposed by FORM's rules and approved by the athlete. */
  source: 'manual' | 'suggested';
  /** The rule version, for suggested targets. */
  ruleVersion?: string;
  /** Body weight the suggestion was computed from. */
  weightKg?: number;
  approvedAt: number;
};

export function formatNutrient(key: NutrientKey, value: number): string {
  const meta = NUTRIENTS[key];
  const n = meta.decimals ? Math.round(value * 10 ** meta.decimals) / 10 ** meta.decimals : Math.round(value);
  return `${n} ${meta.unit}`;
}
