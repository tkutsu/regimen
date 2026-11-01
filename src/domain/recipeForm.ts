import { readValues, valueTexts, type ValueTexts } from "./foodForm";
import { parseAmount, recipeTotals } from "./nutrition";
import type { Food, Recipe } from "./types";

/** A recipe being edited, amounts kept as typed. */
export type RecipeForm = {
  name: string;
  ingredients: { foodId: string; amount: string }[];
  /** The weighed pot, container included; blank until cooked. */
  totalG: string;
  containerG: number;
  /** Per 100 g by hand, for a recipe without ingredients. */
  values: ValueTexts;
  note: string;
};

export function toRecipeForm(recipe?: Recipe): RecipeForm {
  return {
    name: recipe?.name ?? "",
    ingredients: (recipe?.ingredients ?? []).map(({ foodId, amount }) => ({ foodId, amount: String(amount) })),
    totalG: recipe?.totalG ? String(recipe.totalG) : "",
    containerG: recipe?.containerG ?? 0,
    values: valueTexts(recipe?.values),
    note: recipe?.note ?? "",
  };
}

/**
 * The edited recipe, or undefined while it has no name, a bad number, neither ingredients
 * nor kcal written by hand, or no weight to divide by: ingredients counted by the item
 * have no raw weight, so such a recipe must be weighed. Hand-written values are dropped
 * once it has ingredients.
 */
export function fromRecipeForm(form: RecipeForm, id: string, foods: Map<string, Food>): Recipe | undefined {
  const name = form.name.trim();
  const note = form.note.trim();
  const ingredients = form.ingredients.map(({ foodId, amount }) => ({ foodId, amount: parseAmount(amount) ?? 0 }));
  const totalG = form.totalG.trim() ? parseAmount(form.totalG) : 0;
  if (!name || ingredients.some((i) => i.amount <= 0)) return undefined;
  if (totalG === undefined || (totalG > 0 && totalG <= form.containerG)) return undefined;
  const recipe: Recipe = { id, name, ingredients, totalG, containerG: form.containerG };
  if (!ingredients.length) {
    const values = readValues(form.values);
    if (!values) return undefined;
    recipe.values = values;
  } else if (!recipeTotals(recipe, foods).cookedG) return undefined;
  if (note) recipe.note = note;
  return recipe;
}

/** The next cook of a recipe: same ingredients to adjust, not weighed yet. */
export const newBatch = (recipe: Recipe, id: string): Recipe => ({ ...recipe, id, totalG: 0, archived: undefined });
