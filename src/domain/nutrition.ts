import type { State } from "./state";
import type { Food, Nutrients, Recipe } from "./types";

export const NUTRIENTS = ["kcal", "prot", "fiber", "satFat", "unsatFat", "salt"] as const;

export const zero = (): Nutrients => ({ kcal: 0, prot: 0, fiber: 0, satFat: 0, unsatFat: 0, salt: 0 });

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const sum = zero();
  for (const key of NUTRIENTS) sum[key] = a[key] + b[key];
  return sum;
}

/** Nutrients in an amount of food: grams for "100g" foods, a count for "item" foods. */
export function scale(food: Food, amount: number): Nutrients {
  const factor = food.basis === "item" ? amount : amount / 100;
  const out = zero();
  for (const key of NUTRIENTS) out[key] = food[key] * factor;
  return out;
}

/**
 * A recipe as a per-100g food. The cooked weight is the weighed pot minus its
 * container; without a weighing it falls back to the raw ingredient weight.
 */
export function recipeAsFood(recipe: Recipe, foods: Map<string, Food>): Food {
  let total = zero();
  let rawGrams = 0;
  for (const { foodId, amount } of recipe.ingredients) {
    const food = foods.get(foodId);
    if (!food) continue;
    total = add(total, scale(food, amount));
    if (food.basis === "100g") rawGrams += amount;
  }
  const cooked = recipe.totalG - recipe.containerG;
  const grams = cooked > 0 ? cooked : rawGrams;
  const per100 = zero();
  for (const key of NUTRIENTS) per100[key] = grams ? (total[key] / grams) * 100 : 0;
  return { ...per100, id: recipe.id, name: recipe.name, basis: "100g", group: "recipes", fav: true, note: "" };
}

/** Foods plus recipes, which can be eaten like any other food. */
export function allFoods(state: State): Map<string, Food> {
  const foods = new Map(state.foods);
  for (const recipe of state.recipes.values()) foods.set(recipe.id, recipeAsFood(recipe, state.foods));
  return foods;
}
