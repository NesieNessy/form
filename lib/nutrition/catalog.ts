import type { Food, Nutrients, ServingDefinition } from './model';

/**
 * FORM's starter list of generic foods, per 100 g unless noted. The values
 * are approximate generic figures (in the range of USDA FoodData Central's
 * reference foods) and have NOT been verified entry by entry; before real
 * users rely on them they must be checked against FoodData Central or
 * replaced by a licensed database. A value nobody is sure of is `null`.
 * Packaged products differ: the athlete can add their own from the label.
 */
export const CATALOG_VERSION = 'starter_v1';
export const CATALOG_NOTE = 'FORM starter list (approximate generic values)';

type Row = [
  id: string,
  name: string,
  kcal: number | null,
  protein: number | null,
  carbs: number | null,
  fat: number | null,
  fiber: number | null,
  sugar: number | null,
  sodium: number | null,
  servings: ServingDefinition[],
  extra?: Partial<Pick<Food, 'basis' | 'densityGPerMl' | 'isFluid'>> & { caffeine?: number | null },
];

const ROWS: Row[] = [
  ['oats', 'Oats, rolled (dry)', 389, 16.9, 66.3, 6.9, 10.6, null, 2, [{ label: '1/2 cup', grams: 40 }]],
  ['banana', 'Banana', 89, 1.1, 22.8, 0.3, 2.6, 12.2, 1, [{ label: '1 medium', grams: 118 }]],
  ['apple', 'Apple, with skin', 52, 0.3, 13.8, 0.2, 2.4, 10.4, 1, [{ label: '1 medium', grams: 182 }]],
  ['orange', 'Orange', 47, 0.9, 11.8, 0.1, 2.4, 9.4, 0, [{ label: '1 medium', grams: 131 }]],
  ['blueberries', 'Blueberries', 57, 0.7, 14.5, 0.3, 2.4, 10, 1, [{ label: '1 cup', grams: 148 }]],
  ['strawberries', 'Strawberries', 32, 0.7, 7.7, 0.3, 2, 4.9, 1, [{ label: '1 cup', grams: 152 }]],
  ['dates', 'Dates, Medjool', 277, 1.8, 75, 0.2, 6.7, 66.5, 1, [{ label: '1 date', grams: 24 }]],
  ['raisins', 'Raisins', 299, 3.1, 79.2, 0.5, 3.7, 59.2, 11, [{ label: 'small box', grams: 43 }]],
  ['avocado', 'Avocado', 160, 2, 8.5, 14.7, 6.7, 0.7, 7, [{ label: '1/2 avocado', grams: 100 }]],
  ['egg', 'Egg, whole', 143, 12.6, 0.7, 9.5, 0, 0.4, 142, [{ label: '1 large', grams: 50 }]],
  ['chicken_breast', 'Chicken breast, cooked', 165, 31, 0, 3.6, 0, 0, 74, [{ label: '1 breast', grams: 120 }]],
  ['salmon', 'Salmon, cooked', 206, 22.1, 0, 12.4, 0, 0, 61, [{ label: '1 fillet', grams: 150 }]],
  ['tuna_canned', 'Tuna, canned in water, drained', 116, 25.5, 0, 0.8, 0, 0, null, [{ label: '1 can', grams: 120 }]],
  ['beef_mince', 'Beef mince, 90% lean, cooked', 217, 26.1, 0, 11.7, 0, 0, 72, [{ label: '1 portion', grams: 125 }]],
  ['tofu', 'Tofu, firm', 144, 17.3, 2.8, 8.7, 2.3, null, 14, [{ label: '1/2 block', grams: 200 }]],
  ['greek_yogurt', 'Greek yogurt, plain, nonfat', 59, 10.2, 3.6, 0.4, 0, 3.2, 36, [{ label: '1 pot', grams: 170 }]],
  ['cottage_cheese', 'Cottage cheese, 2% fat', 81, 10.5, 4.8, 2.3, 0, 4, null, [{ label: '1/2 cup', grams: 113 }]],
  ['cheddar', 'Cheddar cheese', 403, 24.9, 1.3, 33.1, 0, 0.5, 621, [{ label: '1 slice', grams: 28 }]],
  ['milk_whole', 'Milk, whole', 61, 3.2, 4.8, 3.3, 0, 5.1, 43, [{ label: '1 glass', ml: 250 }], { densityGPerMl: 1.03, isFluid: true }],
  ['milk_skim', 'Milk, skimmed', 34, 3.4, 5, 0.1, 0, 5.1, 42, [{ label: '1 glass', ml: 250 }], { densityGPerMl: 1.035, isFluid: true }],
  ['rice_white', 'Rice, white, cooked', 130, 2.7, 28.2, 0.3, 0.4, 0.1, 1, [{ label: '1 cup', grams: 158 }]],
  ['rice_brown', 'Rice, brown, cooked', 123, 2.7, 25.6, 1, 1.6, 0.2, 4, [{ label: '1 cup', grams: 195 }]],
  ['pasta', 'Pasta, cooked', 158, 5.8, 30.9, 0.9, 1.8, 0.6, 1, [{ label: '1 cup', grams: 140 }]],
  ['bread_wholewheat', 'Bread, whole wheat', 252, 12.4, 42.7, 3.5, 6, 4.4, null, [{ label: '1 slice', grams: 32 }]],
  ['bread_white', 'Bread, white', 266, 7.6, 50.6, 3.3, 2.4, 5.7, null, [{ label: '1 slice', grams: 28 }]],
  ['potato', 'Potato, baked, with skin', 93, 2.5, 21.2, 0.1, 2.2, 1.2, 10, [{ label: '1 medium', grams: 173 }]],
  ['sweet_potato', 'Sweet potato, baked', 90, 2, 20.7, 0.2, 3.3, 6.5, 36, [{ label: '1 medium', grams: 114 }]],
  ['quinoa', 'Quinoa, cooked', 120, 4.4, 21.3, 1.9, 2.8, 0.9, 7, [{ label: '1 cup', grams: 185 }]],
  ['lentils', 'Lentils, cooked', 116, 9, 20.1, 0.4, 7.9, 1.8, 2, [{ label: '1 cup', grams: 198 }]],
  ['chickpeas', 'Chickpeas, cooked', 164, 8.9, 27.4, 2.6, 7.6, 4.8, 7, [{ label: '1 cup', grams: 164 }]],
  ['black_beans', 'Black beans, cooked', 132, 8.9, 23.7, 0.5, 8.7, 0.3, 1, [{ label: '1 cup', grams: 172 }]],
  ['hummus', 'Hummus', 166, 7.9, 14.3, 9.6, 6, 0.3, null, [{ label: '2 tbsp', grams: 30 }]],
  ['broccoli', 'Broccoli', 34, 2.8, 6.6, 0.4, 2.6, 1.7, 33, [{ label: '1 cup', grams: 91 }]],
  ['spinach', 'Spinach, raw', 23, 2.9, 3.6, 0.4, 2.2, 0.4, 79, [{ label: '1 cup', grams: 30 }]],
  ['carrot', 'Carrot, raw', 41, 0.9, 9.6, 0.2, 2.8, 4.7, 69, [{ label: '1 medium', grams: 61 }]],
  ['tomato', 'Tomato', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 5, [{ label: '1 medium', grams: 123 }]],
  ['almonds', 'Almonds', 579, 21.2, 21.6, 49.9, 12.5, 4.4, 1, [{ label: 'handful', grams: 28 }]],
  ['walnuts', 'Walnuts', 654, 15.2, 13.7, 65.2, 6.7, 2.6, 2, [{ label: 'handful', grams: 28 }]],
  ['peanut_butter', 'Peanut butter', 588, 25.1, 20, 50.4, 6, 9.2, null, [{ label: '1 tbsp', grams: 16 }]],
  ['olive_oil', 'Olive oil', 884, 0, 0, 100, 0, 0, 2, [{ label: '1 tbsp', ml: 15 }], { densityGPerMl: 0.91 }],
  ['butter', 'Butter', 717, 0.9, 0.1, 81.1, 0, 0.1, null, [{ label: '1 tsp', grams: 5 }]],
  ['honey', 'Honey', 304, 0.3, 82.4, 0, 0.2, 82.1, 4, [{ label: '1 tbsp', grams: 21 }]],
  ['dark_chocolate', 'Dark chocolate, 70-85%', 598, 7.8, 45.9, 42.6, 10.9, 24, 20, [{ label: '2 squares', grams: 20 }]],
  ['water', 'Water', 0, 0, 0, 0, 0, 0, null, [{ label: '1 glass', ml: 250 }, { label: '1 bottle', ml: 500 }], { basis: 'per_100ml', isFluid: true, densityGPerMl: 1 }],
  ['coffee', 'Coffee, black', 1, 0.1, 0, 0, 0, 0, 2, [{ label: '1 cup', ml: 240 }], { basis: 'per_100ml', isFluid: true, densityGPerMl: 1, caffeine: 40 }],
  ['orange_juice', 'Orange juice', 45, 0.7, 10.4, 0.2, 0.2, 8.4, 1, [{ label: '1 glass', ml: 250 }], { densityGPerMl: 1.04, isFluid: true }],
  ['sports_drink', 'Sports drink (generic)', 24, 0, 6, 0, 0, 6, null, [{ label: '1 bottle', ml: 500 }], { basis: 'per_100ml', isFluid: true, densityGPerMl: 1.02 }],
  ['energy_gel', 'Energy gel (generic)', 100, 0, 25, 0, 0, null, null, [{ label: '1 gel', grams: 32 }], { basis: 'per_serving' }],
];

function toFood([id, name, kcal, protein, carbs, fat, fiber, sugar, sodium, servings, extra]: Row): Food {
  const nutrients: Nutrients = {
    energy_kcal: kcal,
    protein_g: protein,
    carbohydrate_g: carbs,
    fat_g: fat,
    fiber_g: fiber,
    sugar_g: sugar,
    sodium_mg: sodium,
  };
  if (extra?.caffeine !== undefined) nutrients.caffeine_mg = extra.caffeine;
  return {
    id: `catalog:${id}`,
    name,
    basis: extra?.basis ?? 'per_100g',
    nutrients,
    servings,
    densityGPerMl: extra?.densityGPerMl,
    isFluid: extra?.isFluid,
    source: 'catalog',
    sourceNote: `${CATALOG_NOTE}, ${CATALOG_VERSION}`,
    createdAt: 0,
    updatedAt: 0,
  };
}

export const CATALOG: Food[] = ROWS.map(toFood);

/** Case- and accent-insensitive search over the catalog and the athlete's own foods; own foods first. */
export function searchFoods(query: string, own: Food[], limit = 30): Food[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = norm(query).split(/\s+/).filter(Boolean);
  const live = own.filter((f) => !f.deletedAt);
  const all = [...live.sort((a, b) => b.updatedAt - a.updatedAt), ...CATALOG];
  if (!words.length) return all.slice(0, limit);
  return all.filter((f) => words.every((w) => norm(`${f.name} ${f.brand ?? ''}`).includes(w))).slice(0, limit);
}
