import type { State } from "./state";
import type { Change } from "./types";

/** Hides a food, or removes it and every direct use from the current state. */
export function deleteFood(state: State, foodId: string, everywhere = false): Change[] {
  const food = state.foods.get(foodId);
  if (!food) return [];
  if (!everywhere) return [{ type: "food.upsert", food: { ...food, archived: true } }];

  const changes: Change[] = [];
  for (const entry of state.entries.values()) {
    if (entry.foodId === foodId) changes.push({ type: "entry.delete", entryId: entry.id });
  }
  for (const recipe of state.recipes.values()) {
    const ingredients = recipe.ingredients.filter((ingredient) => ingredient.foodId !== foodId);
    if (ingredients.length !== recipe.ingredients.length) {
      // Old handwritten values must not return when the last ingredient is removed.
      changes.push({ type: "recipe.upsert", recipe: { ...recipe, ingredients, values: undefined } });
    }
  }
  const staples = state.settings.staples.filter((staple) => staple.foodId !== foodId);
  if (staples.length !== state.settings.staples.length) changes.push({ type: "settings", settings: { staples } });
  changes.push({ type: "food.delete", foodId });
  return changes;
}
