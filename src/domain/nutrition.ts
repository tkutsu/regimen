import type { State } from "./state";
import type { Change, Food, Nutrients, Recipe, Values } from "./types";

export const NUTRIENTS = ["kcal", "prot", "fiber", "satFat", "unsatFat", "salt", "sugar"] as const;

export const LABELS: Record<keyof Nutrients, string> = {
  kcal: "kcal",
  prot: "protein",
  fiber: "fiber",
  satFat: "sat. fat",
  unsatFat: "unsat. fat",
  salt: "salt",
  sugar: "sugar",
};

/** Nutrients the food's source had no value for. */
export const unknownNutrients = (food: Food) => NUTRIENTS.filter((key) => food[key] === undefined);

export const zero = (): Nutrients => ({ kcal: 0, prot: 0, fiber: 0, satFat: 0, unsatFat: 0, salt: 0, sugar: 0 });

export function add(a: Nutrients, b: Nutrients): Nutrients {
  const sum = zero();
  for (const key of NUTRIENTS) sum[key] = a[key] + b[key];
  return sum;
}

/**
 * Nutrients in an amount of food: grams for "100g" foods, a count for "item" foods.
 * Missing values contribute nothing to the known subtotal; callers must flag incomplete totals.
 */
export function scale(food: Food, amount: number, variantFactor = 1): Nutrients {
  const factor = (food.basis === "item" ? amount : amount / 100) * variantFactor;
  const out = zero();
  for (const key of NUTRIENTS) out[key] = (food[key] ?? 0) * factor;
  return out;
}

/**
 * What a batch adds up to. The cooked weight is the weighed pot minus its container;
 * without a weighing it falls back to the weight of the ingredients counted in grams.
 * Variant factors scale nutrients, leaving the ingredient weights unchanged.
 */
export function recipeTotals(recipe: Recipe, foods: Map<string, Food>) {
  let total = zero();
  let rawG = 0;
  for (const { foodId, amount, factor } of recipe.ingredients) {
    const food = foods.get(foodId);
    if (!food) continue;
    total = add(total, scale(food, amount, factor));
    if (food.basis === "100g") rawG += amount;
  }
  const cookedG = recipe.totalG - recipe.containerG;
  return { total, rawG, cookedG: cookedG > 0 ? cookedG : rawG, weighed: cookedG > 0 };
}

/** Per item or 100 g: divided batch totals, or values written by hand without ingredients. */
export function recipeValues(recipe: Recipe, foods: Map<string, Food>): Values {
  if (!recipe.ingredients.length && recipe.values) return recipe.values;
  const { total, cookedG } = recipeTotals(recipe, foods);
  const divisor = recipe.basis === "item" ? recipe.items ?? 0 : cookedG / 100;
  const values: Values = zero();
  for (const key of NUTRIENTS) values[key] = divisor > 0 ? total[key] / divisor : 0;
  if (!(divisor > 0) || recipe.ingredients.some(({ foodId, amount }) => amount > 0 && foods.get(foodId)?.sugar === undefined)) delete values.sugar;
  return values;
}

/** A recipe as a food in its selected basis; old batches stop being favourites. */
export function recipeAsFood(recipe: Recipe, foods: Map<string, Food>): Food {
  const values = recipeValues(recipe, foods);
  const fav = !recipe.archived && recipe.fav !== false;
  return { ...values, id: recipe.id, name: recipe.name, basis: recipe.basis ?? "100g", group: "recipes", fav, note: recipe.note ?? "", archived: recipe.deleted };
}

/** A food's name where it's already used, marked once it has been deleted. */
export const usedName = (food?: Food) => (food ? `${food.name}${food.archived ? " (deleted)" : ""}` : "unknown food");

/** Stars or unstars one of your foods or recipes. */
export function toggleFav(state: State, id: string): Change[] {
  const recipe = state.recipes.get(id);
  if (recipe) {
    const { fav, ...rest } = recipe;
    return [{ type: "recipe.upsert", recipe: fav === false ? rest : { ...rest, fav: false } }];
  }
  const food = state.foods.get(id);
  return food ? [{ type: "food.upsert", food: { ...food, fav: !food.fav } }] : [];
}

/** Foods plus recipes, which can be eaten like any other food. */
export function allFoods(state: State): Map<string, Food> {
  const foods = new Map(state.foods);
  for (const recipe of state.recipes.values()) foods.set(recipe.id, recipeAsFood(recipe, state.foods));
  return foods;
}

/**
 * Foods supplied to pickers, except replaced recipe batches. Archived foods stay in
 * this map so reference searches exclude them; the picker hides them from its lists.
 */
export function pickableFoods(state: State): Map<string, Food> {
  const foods = allFoods(state);
  for (const recipe of state.recipes.values()) if (recipe.archived) foods.delete(recipe.id);
  return foods;
}

/**
 * Reads +, -, *, / with multiplication and division first. A leading sign
 * adjusts the current amount instead of replacing it: "+50" adds, "-20" removes.
 */
export function parseAmount(text: string, current = 0): number | undefined {
  const s = text.replace(/,/g, ".").replace(/\s+/g, "");
  const number = String.raw`(?:\d+\.?\d*|\.\d+)`;
  const product = `${number}(?:[*/]${number})*`;
  if (!new RegExp(`^[+-]?${product}(?:[+-]${product})*$`).test(s)) return undefined;

  let sum = 0;
  for (const term of s.match(/[+-]?[^+-]+/g)!) {
    const factors = term.split(/([*/])/);
    let value = Number(factors[0]);
    if (!Number.isFinite(value)) return undefined;
    for (let i = 1; i < factors.length; i += 2) {
      const operand = Number(factors[i + 1]);
      if (!Number.isFinite(operand)) return undefined;
      value = factors[i] === "*" ? value * operand : value / operand;
      if (!Number.isFinite(value)) return undefined;
    }
    sum += value;
    if (!Number.isFinite(sum)) return undefined;
  }
  const result = /^[+-]/.test(s) ? current + sum : sum;
  return Number.isFinite(result) ? Math.max(0, result) : undefined;
}
