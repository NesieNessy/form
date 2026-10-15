import type { MealDraftItem } from '../ai/meal';
import { CATALOG } from './catalog';
import { unitsFor, validateQuantity } from './engine';
import type { Food, Quantity } from './model';

/**
 * Turns the assistant's meal draft into items the athlete can check: the
 * matched food (from the catalog or their own foods) and a quantity the app
 * can compute with. Whatever cannot be resolved is left for the athlete.
 */
export type ReviewItem = {
  name: string;
  food?: Food;
  quantity?: Quantity;
  estimated: boolean;
};

export function resolveDraftItem(item: MealDraftItem, ownFoods: Food[]): ReviewItem {
  const food = item.foodId ? [...ownFoods.filter((f) => !f.deletedAt), ...CATALOG].find((f) => f.id === item.foodId) : undefined;
  const base = { name: item.name, food, estimated: item.estimated };
  if (!food || item.amount === null || item.unit === null) return base;
  if (!unitsFor(food).includes(item.unit)) return base;

  let quantity: Quantity = { value: item.amount, unit: item.unit };
  let estimated = item.estimated;
  if (item.unit === 'serving') {
    const wanted = item.servingLabel?.toLowerCase();
    const match = wanted ? food.servings.find((s) => s.label.toLowerCase().includes(wanted)) : undefined;
    // A portion word the food does not know ("a bowl" of oats) is read as its usual serving, and says so.
    if (wanted && !match) estimated = true;
    quantity = { ...quantity, servingLabel: (match ?? food.servings[0]).label };
  }
  return validateQuantity(food, quantity).length ? base : { ...base, quantity, estimated };
}
