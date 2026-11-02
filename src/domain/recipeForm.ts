import { readValues, valueTexts, type ValueTexts } from "./foodForm";
import { parseAmount, recipeTotals } from "./nutrition";
import type { Food, Recipe } from "./types";

/** A recipe being edited, amounts kept as typed. */
export type RecipeForm = {
  name: string;
  basis: Food["basis"];
  items: string;
  ingredients: (Omit<Recipe["ingredients"][number], "amount"> & { amount: string })[];
  /** The weighed pot, container included; blank until cooked. */
  totalG: string;
  containerG: number;
  /** Values in the selected basis, for a recipe without ingredients. */
  values: ValueTexts;
  note: string;
};

export function toRecipeForm(recipe?: Recipe): RecipeForm {
  return {
    name: recipe?.name ?? "",
    basis: recipe?.basis ?? "100g",
    items: String(recipe?.items ?? 1),
    ingredients: (recipe?.ingredients ?? []).map((ingredient) => ({ ...ingredient, amount: String(ingredient.amount) })),
    totalG: recipe?.totalG ? String(recipe.totalG) : "",
    containerG: recipe?.containerG ?? 0,
    values: valueTexts(recipe?.values),
    note: recipe?.note ?? "",
  };
}

/**
 * The edited recipe, or undefined while it has no name, a bad number, neither ingredients
 * nor kcal written by hand, or no weight or item count to divide by.
 * Hand-written values are dropped once it has ingredients.
 */
export function fromRecipeForm(form: RecipeForm, id: string, foods: Map<string, Food>): Recipe | undefined {
  const name = form.name.trim();
  const note = form.note.trim();
  const ingredients = form.ingredients.map((ingredient) => ({ ...ingredient, amount: parseAmount(ingredient.amount) ?? 0 }));
  const item = form.basis === "item";
  const totalG = !item && form.totalG.trim() ? parseAmount(form.totalG) : 0;
  if (!name || ingredients.some((i) => i.amount <= 0)) return undefined;
  if (totalG === undefined || (totalG > 0 && totalG <= form.containerG)) return undefined;
  const recipe: Recipe = { id, name, ingredients, totalG, containerG: item ? 0 : form.containerG };
  if (item) recipe.basis = "item";
  if (!ingredients.length) {
    const values = readValues(form.values);
    if (!values) return undefined;
    recipe.values = values;
  } else if (item) {
    const items = parseAmount(form.items);
    if (!items) return undefined;
    recipe.items = items;
  } else if (!recipeTotals(recipe, foods).cookedG) return undefined;
  if (note) recipe.note = note;
  return recipe;
}

/** The next cook of a recipe: same ingredients to adjust, not weighed yet. */
export const newBatch = (recipe: Recipe, id: string): Recipe => ({ ...recipe, id, totalG: 0, archived: undefined });
