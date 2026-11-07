import type { State } from "./state";
import { recipeValues } from "./nutrition";
import type { Change } from "./types";

/** Removes an unused recipe; a used one leaves a placeholder with its values frozen. */
export function deleteRecipe(state: State, recipeId: string): Change[] {
  const recipe = state.recipes.get(recipeId);
  if (!recipe) return [];
  const used = [...state.entries.values(), ...state.settings.staples].some(({ foodId }) => foodId === recipeId);
  if (!used) return [{ type: "recipe.delete", recipeId }];
  const values = recipeValues(recipe, state.foods);
  return [{ type: "recipe.upsert", recipe: { ...recipe, ingredients: [], values, archived: true, deleted: true } }];
}

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
