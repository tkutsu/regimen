import { parseAmount } from "./nutrition";
import type { Recipe } from "./types";

/** A recipe being edited, amounts kept as typed. */
export type RecipeForm = {
  name: string;
  ingredients: { foodId: string; amount: string }[];
  /** The weighed pot, container included; blank until cooked. */
  totalG: string;
  containerG: number;
};

export function toRecipeForm(recipe?: Recipe): RecipeForm {
  return {
    name: recipe?.name ?? "",
    ingredients: (recipe?.ingredients ?? []).map(({ foodId, amount }) => ({ foodId, amount: String(amount) })),
    totalG: recipe?.totalG ? String(recipe.totalG) : "",
    containerG: recipe?.containerG ?? 0,
  };
}

/** The edited recipe, or undefined while it has no name, no ingredients, or a bad number. */
export function fromRecipeForm(form: RecipeForm, id: string): Recipe | undefined {
  const name = form.name.trim();
  const ingredients = form.ingredients.map(({ foodId, amount }) => ({ foodId, amount: parseAmount(amount) ?? 0 }));
  const totalG = form.totalG.trim() ? parseAmount(form.totalG) : 0;
  if (!name || !ingredients.length || ingredients.some((i) => i.amount <= 0)) return undefined;
  if (totalG === undefined || (totalG > 0 && totalG <= form.containerG)) return undefined;
  return { id, name, ingredients, totalG, containerG: form.containerG };
}

/** The next cook of a recipe: same ingredients to adjust, not weighed yet. */
export const newBatch = (recipe: Recipe, id: string): Recipe => ({ ...recipe, id, totalG: 0, archived: undefined });
