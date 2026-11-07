import { recipeValues } from "./nutrition";
import { newId, type State } from "./state";
import type { Change, Food, Recipe } from "./types";

/** An archived copy holding the recipe's values as they are now, so later edits leave its days alone. */
const freeze = (recipe: Recipe, foods: Map<string, Food>): Recipe => ({
  ...recipe,
  ingredients: [],
  values: recipeValues(recipe, foods),
  archived: true,
});

/**
 * Saves an edited recipe without changing days before today. Once its values change and it was
 * eaten before today, the saved version stays frozen under its id for those days, and the edit
 * takes a new id that today's and later entries and the staples follow.
 * `added` are reference foods picked as ingredients; `replaces` is the batch a new batch follows.
 */
export function saveRecipe(state: State, edited: Recipe, added: Food[], today: string, replaces?: Recipe): Change[] {
  const foods = new Map([...state.foods, ...added.map((food): [string, Food] => [food.id, food])]);
  const saved = state.recipes.get(edited.id);
  // The editor doesn't show the star, so an unstarred recipe stays unstarred.
  const fav = (saved ?? replaces)?.fav;
  const recipe = fav === false ? { ...edited, fav } : edited;
  const changes: Change[] = [
    ...added.map((food) => ({ type: "food.upsert" as const, food })),
    ...(replaces ? [{ type: "recipe.upsert" as const, recipe: freeze(replaces, foods) }] : []),
  ];

  const eatenBefore = [...state.entries.values()].some((entry) => entry.foodId === edited.id && entry.date < today);
  const same = saved && JSON.stringify(recipeValues(saved, foods)) === JSON.stringify(recipeValues(recipe, foods));
  if (!saved || !eatenBefore || same) return [...changes, { type: "recipe.upsert", recipe }];

  const id = newId();
  changes.push({ type: "recipe.upsert", recipe: freeze(saved, foods) }, { type: "recipe.upsert", recipe: { ...recipe, id } });
  for (const entry of state.entries.values()) {
    if (entry.foodId === edited.id && entry.date >= today) changes.push({ type: "entry.upsert", entry: { ...entry, foodId: id } });
  }
  const { staples } = state.settings;
  if (staples.some((staple) => staple.foodId === edited.id)) {
    changes.push({ type: "settings", settings: { staples: staples.map((staple) => (staple.foodId === edited.id ? { ...staple, foodId: id } : staple)) } });
  }
  return changes;
}

/** Removes an unused recipe; a used one leaves a placeholder with its values frozen. */
export function deleteRecipe(state: State, recipeId: string): Change[] {
  const recipe = state.recipes.get(recipeId);
  if (!recipe) return [];
  const used = [...state.entries.values(), ...state.settings.staples].some(({ foodId }) => foodId === recipeId);
  if (!used) return [{ type: "recipe.delete", recipeId }];
  return [{ type: "recipe.upsert", recipe: { ...freeze(recipe, state.foods), deleted: true } }];
}
